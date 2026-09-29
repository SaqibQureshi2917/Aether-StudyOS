"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = exports.AppError = void 0;
const multer_1 = __importDefault(require("multer"));
class AppError extends Error {
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}
exports.AppError = AppError;
const errorHandler = (err, req, res, next) => {
    const uploadError = err instanceof multer_1.default.MulterError ? err : null;
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
exports.errorHandler = errorHandler;
