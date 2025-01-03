// src/middleware/error.middleware.ts
import { Request, Response, NextFunction } from 'express';
import ApiError from '../utils/ApiError';
import { logger } from '../utils/logger';

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error('Error 💥:', err);

  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
    return;
  }

  res.status(500).json({
    status: 'error',
    message: 'Something went wrong!',
  });
};