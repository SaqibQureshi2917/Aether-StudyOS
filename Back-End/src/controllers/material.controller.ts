import { Response, NextFunction } from 'express';
import fs from 'fs';
import { prisma } from '../config/db';
import { AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

// CJS require for pdf-parse to fix TypeScript callable signature error
const pdfParse = require('pdf-parse');

export const uploadMaterial = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    const { courseId, courseName } = req.body;

    if (!file) {
      throw new AppError('Please attach a PDF or syllabus document file.', 400);
    }
    if (!courseId) {
      throw new AppError('Course ID is required for material upload.', 400);
    }

    let extractedText = '';

    // Extract text if PDF
    if (file.mimetype === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      const dataBuffer = fs.readFileSync(file.path);
      const pdfData = await pdfParse(dataBuffer);
      extractedText = pdfData.text;
    }

    // Matching exact Prisma Material schema fields (fileUrl, fileType, title, courseId)
    const newMaterial = await prisma.courseMaterial.create({
      data: {
        title: courseName || file.originalname.replace(/\.[^/.]+$/, ''),
        fileUrl: file.path,
        fileType: file.mimetype,
        isIndexed: extractedText.length > 0,
        courseId,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Course material uploaded & indexed successfully!',
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
    // Selects only valid fields defined in schema.prisma
    const materials = await prisma.courseMaterial.findMany({
      select: {
        id: true,
        title: true,
        fileUrl: true,
        fileType: true,
        isIndexed: true,
        createdAt: true,
        courseId: true,
      },
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