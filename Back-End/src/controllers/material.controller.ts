import { Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { prisma } from '../config/db';
import { AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// CJS require for pdf-parse to fix TypeScript callable signature error
const pdfParse = require('pdf-parse');

export const uploadMaterial = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    const { courseId, title } = req.body;
    const userId = req.user?.userId;

    if (!file) {
      throw new AppError('Please attach a PDF or syllabus document file.', 400);
    }
    if (!courseId) {
      throw new AppError('Course ID is required for material upload.', 400);
    }
    if (!userId) throw new AppError('Unauthorized access', 401);

    const course = await prisma.course.findFirst({
      where: { id: courseId, semester: { userId } },
      select: { id: true },
    });
    if (!course) throw new AppError('Course not found.', 404);

    let extractedText = '';

    // Only PDF extraction is currently implemented; do not claim DOCX/PPTX were indexed.
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      const dataBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(dataBuffer);
      extractedText = pdfData.text;
    }

    const materialTitle = typeof title === 'string' && title.trim()
      ? title.trim().slice(0, 200)
      : file.originalname.replace(/\.[^/.]+$/, '').slice(0, 200);

    // Keep extracted text available for processing, but don't label it indexed until embeddings exist.
    const newMaterial = await prisma.courseMaterial.create({
      data: {
        title: materialTitle,
        fileUrl: file.path,
        fileType: file.mimetype,
        extractedText: extractedText || null,
        isIndexed: false,
        courseId,
      },
      select: {
        id: true,
        title: true,
        fileType: true,
        isIndexed: true,
        courseId: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      success: true,
      message: extractedText ? 'Material uploaded and text extracted.' : 'Material uploaded.',
      data: {
        material: newMaterial,
        extractedTextLength: extractedText.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getUserMaterials = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Unauthorized access', 401);
    // Selects only valid fields defined in schema.prisma
    const materials = await prisma.courseMaterial.findMany({
      select: {
        id: true,
        title: true,
        fileType: true,
        isIndexed: true,
        createdAt: true,
        courseId: true,
      },
      where: { course: { semester: { userId } } },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      data: { materials },
    });
  } catch (error) {
    next(error);
  }
};

export const downloadMaterial = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Unauthorized access', 401);
    const material = await prisma.courseMaterial.findFirst({
      where: { id: req.params.id, course: { semester: { userId } } },
      select: { fileUrl: true, title: true, fileType: true },
    });
    if (!material) throw new AppError('Material not found.', 404);
    const uploadRoot = path.resolve(process.cwd(), 'uploads');
    const filePath = path.resolve(material.fileUrl);
    if (!filePath.startsWith(`${uploadRoot}${path.sep}`) || !fs.existsSync(filePath)) {
      throw new AppError('Material file is unavailable.', 404);
    }
    res.download(filePath, path.basename(filePath), (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
};
