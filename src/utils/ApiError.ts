import { IApiError } from '../interfaces/error.interface';

class ApiError extends Error implements IApiError {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(statusCode: any, message: any) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export { ApiError };
