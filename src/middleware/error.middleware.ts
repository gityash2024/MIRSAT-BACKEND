import { Request, Response, NextFunction } from 'express';
import ApiError from '../utils/ApiError';
import { logger } from '../utils/logger';

interface ExtendedError extends Error {
  statusCode?: number;
  code?: number;
  errors?: any;
  type?: string;
  limit?: number;
  length?: number;
  expected?: boolean;
  isEmailError?: boolean;
}

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = err as ExtendedError;

  // Log error
  logger.error('Error 💥:', err);

  // Handle email service errors specially
  if (error.message === 'Failed to send email') {
    error.isEmailError = true;
    
    // If this is a task creation or update endpoint, don't fail the operation
    if (req.originalUrl.includes('/tasks') && (req.method === 'POST' || req.method === 'PUT')) {
      logger.warn('Email service error encountered, but continuing operation');
      res.status(201).json({
        success: true,
        message: 'Operation completed successfully, but email notifications could not be sent',
        data: res.locals.data || {}
      });
      return;
    }
    
    // For other routes, return a 200 with a warning
    res.status(200).json({
      success: true,
      warning: 'Operation completed, but email notifications could not be sent',
      data: res.locals.data || {}
    });
    return;
  }

  // Handle payload too large error from express-json
  if ((error as any).type === 'entity.too.large') {
    const message = `Request entity too large. The payload size (${(error as any).length}) exceeds the limit (${(error as any).limit}).`;
    error = new ApiError(message, 413);
    logger.warn(`Payload too large: ${message}`);
  }

  // Handle request timeout errors
  if (error.name === 'TimeoutError' || (error as any).code === 'ETIMEDOUT') {
    error = new ApiError('Request timeout - operation took too long to complete', 408);
    logger.warn('Request timeout error encountered');
  }

  // Mongoose bad ObjectId
  if (error.name === 'CastError') {
    error = new ApiError('Resource not found', 404);
  }

  // Mongoose duplicate key
  if ((error as any).code === 11000) {
    error = new ApiError('Duplicate field value entered', 400);
  }

  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const message = Object.values((error as any).errors)
      .map((val: any) => val.message)
      .join(', ');
    error = new ApiError(message, 400);
  }

  // Out of memory errors - may happen with large documents
  if (error.name === 'RangeError' && error.message.includes('heap')) {
    error = new ApiError('Server memory limit exceeded. Try with smaller payload.', 413);
    logger.error('Server memory limit exceeded', error);
  }

  // If it's not an operational error, set status code to 500
  let statusCode = 500;
  try {
    statusCode = error instanceof ApiError && typeof error.statusCode === 'number' 
      ? error.statusCode 
      : 500;
  } catch (instanceofError) {
    logger.error('Error in instanceof check:', instanceofError);
    statusCode = 500;
  }
  
  const message = error.message || 'Internal Server Error';

  // Send more detailed error in development
  res.status(statusCode).json({
    success: false,
    error: {
      statusCode,
      message,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: error.stack,
        name: error.name,
        code: (error as any).code
      }),
    },
  });
};