export interface IApiError extends Error {
    statusCode: number;
    status: string;
    isOperational?: boolean;
  }