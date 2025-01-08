import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

interface ExtendedError extends Error {
  statusCode?: number;
  code?: number;
  errors?: any;
}

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = err as ExtendedError;

  // Log error
  logger.error('Error 💥:', err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    error = new ApiError('Resource not found', 404);
  }

  // Mongoose duplicate key
  if ((err as any).code === 11000) {
    error = new ApiError('Duplicate field value entered', 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values((err as any).errors)
      .map((val: any) => val.message)
      .join(', ');
    error = new ApiError(message, 400);
  }

  // If it's not an operational error, set status code to 500
  const statusCode = error instanceof ApiError ? error.statusCode : 500;
  const message = error.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    error: {
      statusCode,
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};