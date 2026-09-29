import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

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
  const uploadError = err instanceof multer.MulterError ? err : null;
  const statusCode = err instanceof AppError ? err.statusCode : uploadError ? 400 : 500;
  const message = err instanceof AppError
    ? err.message
    : uploadError?.code === 'LIMIT_FILE_SIZE'
      ? 'The file exceeds the 15 MB upload limit.'
      : uploadError
        ? 'The uploaded file could not be accepted.'
        : 'Something went wrong. Please try again.';
  res.status(statusCode).json({
    success: false,
    error: { message },
  });
};
