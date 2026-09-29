import multer from 'multer';
import path from 'path';
import { AppError } from './error.middleware';

const allowedExtensions = new Set(['.pdf', '.docx', '.jpg', '.jpeg', '.png', '.webp']);

export const chatAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, callback) => {
    if (!allowedExtensions.has(path.extname(file.originalname).toLowerCase())) {
      callback(new AppError('Choose a PDF, DOCX, JPG, PNG, or WebP file.', 400));
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});
