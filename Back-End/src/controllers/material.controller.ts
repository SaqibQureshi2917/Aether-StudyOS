import { Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { inflateRawSync } from 'zlib';
import { prisma } from '../config/db';
import { AppError } from '../middleware/error.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { DocumentExtractionService } from '../services/document/extraction.service';
import { DocumentIndexingService } from '../services/document/indexing.service';
import { AIProviderError } from '../services/ai/ai-provider.interface';
import { FileStorageService } from '../services/document/file-storage.service';
import { z } from 'zod';

// CJS require for pdf-parse to fix TypeScript callable signature error
const pdfParse = require('pdf-parse');

const extractOfficeXmlText = (buffer: Buffer, filePattern: RegExp) => {
  const eocdSignature = 0x06054b50;
  const centralSignature = 0x02014b50;
  const localSignature = 0x04034b50;
  const minSearchOffset = Math.max(0, buffer.length - 65557);
  let eocdOffset = -1;
  for (let offset = buffer.length - 22; offset >= minSearchOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) return '';

  const entries = buffer.readUInt16LE(eocdOffset + 10);
  let cursor = buffer.readUInt32LE(eocdOffset + 16);
  const xmlDocuments: string[] = [];
  let totalUncompressedBytes = 0;
  for (let entry = 0; entry < entries && cursor + 46 <= buffer.length; entry += 1) {
    if (buffer.readUInt32LE(cursor) !== centralSignature) break;
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const fileName = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!filePattern.test(fileName) || uncompressedSize > 20 * 1024 * 1024 || totalUncompressedBytes + uncompressedSize > 20 * 1024 * 1024 || localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== localSignature) continue;

    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    const xml = method === 0 ? compressed.toString('utf8') : method === 8 ? inflateRawSync(compressed, { maxOutputLength: 20 * 1024 * 1024 }).toString('utf8') : '';
    if (xml) {
      totalUncompressedBytes += uncompressedSize;
      xmlDocuments.push(xml);
    }
  }

  return xmlDocuments.map((xml) => xml
    .replace(/<\/w:p>|<\/a:p>/g, '\n')
    .replace(/<w:tab\s*\/>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'"))
    .join('\n');
};

export const uploadMaterial = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    const { courseId, title } = req.body;
    const userId = req.user?.userId;

    if (!file) throw new AppError('Please attach a supported academic document.', 400);
    if (!courseId) {
      throw new AppError('Course ID is required for material upload.', 400);
    }
    if (!userId) throw new AppError('Unauthorized access', 401);

    const extension = path.extname(file.originalname).toLowerCase();
    const signature = file.buffer.subarray(0, 4);
    const isPdf = extension === '.pdf' && signature.subarray(0, 4).toString('ascii') === '%PDF';
    const isOfficeDocument = (extension === '.docx' || extension === '.pptx')
      && signature[0] === 0x50 && signature[1] === 0x4b;
    const isText = extension === '.txt' && file.buffer.length > 0;
    if (!isPdf && !isOfficeDocument && !isText) {
      throw new AppError('This file does not match a supported PDF, DOCX, PPTX, or TXT document.', 400);
    }

    const course = await prisma.course.findFirst({
      where: { id: courseId, semester: { userId } },
      select: { id: true },
    });
    if (!course) throw new AppError('Course not found.', 404);

    let extractedText = '';

    const lowerFileName = file.originalname.toLowerCase();
    if (extension === '.pdf') {
      const pdfData = await pdfParse(file.buffer);
      extractedText = pdfData.text;
    } else if (lowerFileName.endsWith('.docx')) {
      extractedText = extractOfficeXmlText(file.buffer, /^word\/document\.xml$/i);
    } else if (lowerFileName.endsWith('.pptx')) {
      extractedText = extractOfficeXmlText(file.buffer, /^ppt\/slides\/slide\d+\.xml$/i);
    } else if (extension === '.txt') {
      extractedText = file.buffer.toString('utf8').replace(/\0/g, '');
    }

    const materialTitle = typeof title === 'string' && title.trim()
      ? title.trim().slice(0, 200)
      : file.originalname.replace(/\.[^/.]+$/, '').slice(0, 200);

    const contentTypeByExtension: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt': 'text/plain; charset=utf-8',
    };
    const storedContentType = contentTypeByExtension[extension];
    const storageKey = await FileStorageService.store(userId, courseId, file.originalname, storedContentType, file.buffer);
    let newMaterial;
    try {
    // Persist metadata and extracted text; binary content stays in the configured file store.
    newMaterial = await prisma.courseMaterial.create({
      data: {
        title: materialTitle,
        storageKey,
        fileType: storedContentType,
        fileSizeBytes: file.size,
        extractedText: extractedText || null,
        isIndexed: false,
        processingStatus: extractedText.trim() ? 'PROCESSING' : 'FAILED',
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

    let isIndexed = false;
    let indexingMessage: string | null = null;
    if (extractedText.trim()) {
      try {
        isIndexed = (await DocumentIndexingService.indexMaterial(newMaterial.id, newMaterial.title, extractedText)) > 0;
      } catch {
        indexingMessage = 'The file was uploaded, but could not be prepared for StudyOS Tutor. You can upload it again later.';
      }
    }

    let extractedAssignment: Awaited<ReturnType<typeof DocumentExtractionService.extractAssignmentFromText>> = null;
    if (extractedText) {
      extractedAssignment = await DocumentExtractionService.extractAssignmentFromText(newMaterial.id, extractedText);
      if (extractedAssignment) {
        await prisma.courseMaterial.update({
          where: { id: newMaterial.id },
          data: { metadata: { assignmentDraft: extractedAssignment } },
        });
      }
    }
    await prisma.courseMaterial.update({ where: { id: newMaterial.id }, data: { processingStatus: isIndexed ? 'INDEXED' : 'FAILED' } });

    res.status(201).json({
      success: true,
      message: extractedText ? 'Material uploaded and text extracted.' : 'Material uploaded.',
      data: {
        material: { ...newMaterial, isIndexed },
        extractedTextLength: extractedText.length,
        extractedAssignment,
        assignmentDraft: extractedAssignment,
        indexingMessage,
      },
    });
    await prisma.course.update({ where: { id: courseId }, data: { outlineReviewedAt: null } });
    } catch (error) {
      if (!newMaterial) await FileStorageService.remove(storageKey).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

export const getUserMaterials = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Unauthorized access', 401);
    // Selects only valid fields defined in schema.prisma
    const courseId = typeof req.query.courseId === 'string' ? req.query.courseId : undefined;
    if (courseId) {
      const ownedCourse = await prisma.course.findFirst({ where: { id: courseId, semester: { userId } }, select: { id: true } });
      if (!ownedCourse) throw new AppError('Subject not found.', 404);
    }
    const materials = await prisma.courseMaterial.findMany({
      select: {
        id: true,
        title: true,
        fileType: true,
        fileSizeBytes: true,
        isIndexed: true,
        processingStatus: true,
        createdAt: true,
        courseId: true,
        metadata: true,
      },
      where: { course: { semester: { userId }, ...(courseId ? { id: courseId } : {}) } },
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

export const indexUserMaterial = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Your session has expired. Sign in and try again.', 401);
    const material = await prisma.courseMaterial.findFirst({
      where: { id: req.params.id, course: { semester: { userId } } },
      select: { id: true, title: true, extractedText: true, isIndexed: true },
    });
    if (!material) throw new AppError('This course document could not be found.', 404);
    if (!material.extractedText?.trim()) throw new AppError('This file does not contain readable text for Tutor search.', 400);
    if (material.isIndexed) return res.status(200).json({ success: true, data: { material, chunkCount: null } });

    const chunkCount = await DocumentIndexingService.indexMaterial(material.id, material.title, material.extractedText);
    return res.status(200).json({
      success: true,
      data: { material: { id: material.id, title: material.title, isIndexed: chunkCount > 0 }, chunkCount },
    });
  } catch (error) {
    if (error instanceof AIProviderError) return next(new AppError('Document indexing is temporarily unavailable. Please try again later.', 503));
    if (error instanceof Error && error.message.includes('too large to index')) {
      return next(new AppError(error.message, 400));
    }
    return next(error);
  }
};

export const downloadMaterial = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Unauthorized access', 401);
    const material = await prisma.courseMaterial.findFirst({
      where: { id: req.params.id, course: { semester: { userId } } },
      select: { fileUrl: true, storageKey: true, title: true, fileType: true },
    });
    if (!material) throw new AppError('Material not found.', 404);
    if (material.storageKey) {
      const contents = await FileStorageService.read(material.storageKey);
      const extension = path.extname(material.storageKey) || '.bin';
      res.type(material.fileType || 'application/octet-stream').attachment(`${material.title}${extension}`).send(contents);
      return;
    }
    if (!material.fileUrl) throw new AppError('Material file is unavailable.', 404);
    const uploadRoot = path.resolve(process.cwd(), 'uploads');
    const filePath = path.resolve(material.fileUrl);
    if (!filePath.startsWith(`${uploadRoot}${path.sep}`) || !fs.existsSync(filePath)) throw new AppError('Material file is unavailable.', 404);
    res.download(filePath, path.basename(filePath), (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    next(error);
  }
};

const renameMaterialSchema = z.object({ title: z.string().trim().min(1).max(200) });
const confirmAssignmentSchema = z.object({
  deadline: z.string().datetime(),
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(10_000).nullable().optional(),
  estimatedHours: z.number().finite().positive().max(1000).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
});

export const renameMaterial = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Unauthorized access', 401);
    const parsed = renameMaterialSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Enter a valid document title.', 400);
    const material = await prisma.courseMaterial.findFirst({ where: { id: req.params.id, course: { semester: { userId } } }, select: { id: true, extractedText: true } });
    if (!material) throw new AppError('Material not found.', 404);
    const renamed = await prisma.courseMaterial.update({ where: { id: material.id }, data: { title: parsed.data.title, isIndexed: false, processingStatus: 'UPLOADED' }, select: { id: true, title: true, courseId: true, processingStatus: true } });
    await prisma.documentChunk.deleteMany({ where: { materialId: material.id } });
    let indexed = false;
    if (material.extractedText?.trim()) {
      try { indexed = (await DocumentIndexingService.indexMaterial(material.id, parsed.data.title, material.extractedText)) > 0; }
      catch { await prisma.courseMaterial.update({ where: { id: material.id }, data: { processingStatus: 'FAILED', isIndexed: false } }); }
    }
    return res.status(200).json({ success: true, data: { material: { ...renamed, isIndexed: indexed, processingStatus: indexed ? 'INDEXED' : material.extractedText ? 'FAILED' : 'UPLOADED' } } });
  } catch (error) { return next(error); }
};

export const deleteMaterial = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Unauthorized access', 401);
    const material = await prisma.courseMaterial.findFirst({ where: { id: req.params.id, course: { semester: { userId } } }, select: { id: true, courseId: true, storageKey: true, fileUrl: true } });
    if (!material) throw new AppError('Material not found.', 404);
    await prisma.$transaction(async (tx) => {
      await tx.citation.deleteMany({ where: { documentId: material.id } });
      await tx.courseMaterial.delete({ where: { id: material.id } });
      await tx.course.update({ where: { id: material.courseId }, data: { outlineReviewedAt: null } });
    });
    let cleanupPending = false;
    if (material.storageKey) {
      try { await FileStorageService.remove(material.storageKey); }
      catch { cleanupPending = true; }
    } else if (material.fileUrl) {
      const uploadRoot = path.resolve(process.cwd(), 'uploads');
      const oldPath = path.resolve(material.fileUrl);
      if (oldPath.startsWith(`${uploadRoot}${path.sep}`) && fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch { cleanupPending = true; }
      }
    }
    return res.status(200).json({ success: true, data: { deleted: true, cleanupPending } });
  } catch (error) { return next(error); }
};

export const confirmMaterialAssignment = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) throw new AppError('Unauthorized access', 401);
    const parsed = confirmAssignmentSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message || 'Review the assignment details.', 400);
    const material = await prisma.courseMaterial.findFirst({ where: { id: req.params.id, course: { semester: { userId } } }, select: { id: true, courseId: true, metadata: true } });
    if (!material) throw new AppError('Material not found.', 404);
    const metadata = material.metadata && typeof material.metadata === 'object' && !Array.isArray(material.metadata) ? material.metadata as Record<string, unknown> : {};
    const draft = metadata.assignmentDraft as Record<string, unknown> | undefined;
    if (!draft || metadata.confirmedAssignmentId) throw new AppError('There is no unconfirmed assignment draft for this material.', 409);
    const deadline = new Date(parsed.data.deadline);
    if (!Number.isFinite(deadline.getTime()) || deadline <= new Date()) throw new AppError('Choose a future deadline before confirming this assignment.', 400);
    const assignment = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "CourseMaterial" WHERE "id" = ${material.id} FOR UPDATE`;
      const fresh = await tx.courseMaterial.findUnique({ where: { id: material.id }, select: { metadata: true, courseId: true } });
      const currentMetadata = fresh?.metadata && typeof fresh.metadata === 'object' && !Array.isArray(fresh.metadata) ? fresh.metadata as Record<string, unknown> : {};
      const currentDraft = currentMetadata.assignmentDraft as Record<string, unknown> | undefined;
      if (!fresh || !currentDraft || currentMetadata.confirmedAssignmentId) throw new AppError('This assignment draft has already been confirmed.', 409);
      const created = await tx.assignment.create({
        data: {
          courseId: fresh.courseId,
          title: (parsed.data.title || String(currentDraft.title || '')).trim().slice(0, 200),
          description: parsed.data.description === undefined ? (typeof currentDraft.description === 'string' ? currentDraft.description : null) : parsed.data.description,
          deadline,
          difficulty: parsed.data.difficulty || (['EASY', 'MEDIUM', 'HARD'].includes(String(currentDraft.difficulty)) ? currentDraft.difficulty as 'EASY' | 'MEDIUM' | 'HARD' : 'MEDIUM'),
          estimatedHours: parsed.data.estimatedHours || (typeof currentDraft.estimatedHours === 'number' ? Math.min(1000, Math.max(0.1, currentDraft.estimatedHours)) : 2),
          estimateSource: 'AI_ASSISTANT',
        },
      });
      await tx.courseMaterial.update({ where: { id: material.id }, data: { metadata: { ...currentMetadata, assignmentDraft: null, confirmedAssignmentId: created.id } as any } });
      return created;
    });
    return res.status(201).json({ success: true, data: { assignment } });
  } catch (error) { return next(error); }
};
