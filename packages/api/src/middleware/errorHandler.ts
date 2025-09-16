import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/ApiError.js';

export function errorHandler(
  err: Error | ApiError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Convert non-ApiError instances to ApiError
  let apiError: ApiError;

  if (err instanceof ApiError) {
    apiError = err;
  } else {
    // Wrap unexpected errors
    apiError = new ApiError(
      process.env['NODE_ENV'] === 'production' ? 'Internal Server Error' : err.message,
      500,
      'INTERNAL_ERROR',
      false,
    );
    // Log the original error for debugging
    console.error('Unexpected error:', err);
  }

  const { statusCode, message, code, isOperational, context } = apiError;

  // Log non-operational errors (unexpected errors)
  if (!isOperational) {
    console.error('Critical error:', {
      code,
      message,
      stack: err.stack,
      context,
      request: {
        method: req.method,
        url: req.originalUrl,
        headers: req.headers,
        body: req.body,
      },
    });
  }

  // Send error response
  res.status(statusCode).json({
    error: {
      code,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      ...(process.env['NODE_ENV'] !== 'production' && context ? { context } : {}),
    },
  });
}
