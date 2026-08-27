import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  res.status(statusCode).json({
    success: false,
    error: { message: err.message || 'Internal Server Error' },
  });
};