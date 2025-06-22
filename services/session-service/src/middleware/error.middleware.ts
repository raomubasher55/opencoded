import { Request, Response, NextFunction } from 'express';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('error-middleware');

/**
 * Error response interface
 */
export interface ErrorResponse {
  success: false;
  message: string;
  error?: string;
  stack?: string;
}

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  statusCode: number;
  
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

/**
 * Not found middleware - handles 404 errors
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  const error = new ApiError(`Not Found - ${req.originalUrl}`, 404);
  next(error);
};

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response<ErrorResponse>,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  // Determine status code (default to 500)
  const statusCode = 'statusCode' in err ? err.statusCode : 500;
  
  // Create error response
  const errorResponse: ErrorResponse = {
    success: false,
    message: err.message || 'Server Error',
  };
  
  // Add stack trace in development
  if (process.env.NODE_ENV !== 'production') {
    errorResponse.stack = err.stack;
  }
  
  // Log the error
  logger.error(`${statusCode} - ${err.message}`, { 
    path: req.path,
    method: req.method,
    error: err 
  });
  
  // Send error response
  res.status(statusCode).json(errorResponse);
};