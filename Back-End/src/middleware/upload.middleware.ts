import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AppError } from './error.middleware';

// Ensure uploads folder exists
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Storage Engine Config
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// File Filter (Only PDF, DOCX, PPTX allowed)
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimetypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ];

  if (allowedMimetypes.includes(file.mimetype) || file.originalname.endsWith('.pdf')) {
    cb(null, true);
  } else {
    cb(new AppError('Only PDF, DOCX, and PPTX files are allowed!', 400) as any, false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
});