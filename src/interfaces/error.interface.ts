export interface IErrorResponse {
  success: boolean;
  error: {
    statusCode: number;
    message: string;
    stack?: string;
  };
}

export interface IValidationError {
  success: boolean;
  errors: Array<{
    value: string;
    msg: string;
    param: string;
    location: string;
  }>;
}

export interface IApiError {
  statusCode: number;
  status: string;
  isOperational: boolean;
}