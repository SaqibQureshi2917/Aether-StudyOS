import multer from 'multer';
import { AppError } from './error.middleware';
import path from 'path';

// File Filter (Only PDF, DOCX, PPTX allowed)
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.pdf', '.docx', '.pptx', '.txt'];
  if (allowedExtensions.includes(extension)) {
    cb(null, true);
  } else {
    cb(new AppError('Choose a PDF, DOCX, PPTX, or TXT file.', 400) as any, false);
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});
