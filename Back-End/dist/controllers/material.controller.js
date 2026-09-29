"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadMaterial = exports.indexUserMaterial = exports.getUserMaterials = exports.uploadMaterial = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const zlib_1 = require("zlib");
const db_1 = require("../config/db");
const error_middleware_1 = require("../middleware/error.middleware");
const extraction_service_1 = require("../services/document/extraction.service");
const indexing_service_1 = require("../services/document/indexing.service");
const ai_provider_interface_1 = require("../services/ai/ai-provider.interface");
// CJS require for pdf-parse to fix TypeScript callable signature error
const pdfParse = require('pdf-parse');
const extractOfficeXmlText = (buffer, filePattern) => {
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
    if (eocdOffset < 0)
        return '';
    const entries = buffer.readUInt16LE(eocdOffset + 10);
    let cursor = buffer.readUInt32LE(eocdOffset + 16);
    const xmlDocuments = [];
    let totalUncompressedBytes = 0;
    for (let entry = 0; entry < entries && cursor + 46 <= buffer.length; entry += 1) {
        if (buffer.readUInt32LE(cursor) !== centralSignature)
            break;
        const method = buffer.readUInt16LE(cursor + 10);
        const compressedSize = buffer.readUInt32LE(cursor + 20);
        const uncompressedSize = buffer.readUInt32LE(cursor + 24);
        const nameLength = buffer.readUInt16LE(cursor + 28);
        const extraLength = buffer.readUInt16LE(cursor + 30);
        const commentLength = buffer.readUInt16LE(cursor + 32);
        const localOffset = buffer.readUInt32LE(cursor + 42);
        const fileName = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
        cursor += 46 + nameLength + extraLength + commentLength;
        if (!filePattern.test(fileName) || uncompressedSize > 20 * 1024 * 1024 || totalUncompressedBytes + uncompressedSize > 20 * 1024 * 1024 || localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== localSignature)
            continue;
        const localNameLength = buffer.readUInt16LE(localOffset + 26);
        const localExtraLength = buffer.readUInt16LE(localOffset + 28);
        const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
        const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
        const xml = method === 0 ? compressed.toString('utf8') : method === 8 ? (0, zlib_1.inflateRawSync)(compressed).toString('utf8') : '';
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
const uploadMaterial = async (req, res, next) => {
    try {
        const file = req.file;
        const { courseId, title } = req.body;
        const userId = req.user?.userId;
        if (!file) {
            throw new error_middleware_1.AppError('Please attach a PDF or syllabus document file.', 400);
        }
        if (!courseId) {
            throw new error_middleware_1.AppError('Course ID is required for material upload.', 400);
        }
        if (!userId)
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        const extension = path_1.default.extname(file.originalname).toLowerCase();
        const signature = fs_1.default.readFileSync(file.path).subarray(0, 4);
        const isPdf = extension === '.pdf' && signature.subarray(0, 4).toString('ascii') === '%PDF';
        const isOfficeDocument = (extension === '.docx' || extension === '.pptx')
            && signature[0] === 0x50 && signature[1] === 0x4b;
        if (!isPdf && !isOfficeDocument) {
            fs_1.default.unlinkSync(file.path);
            throw new error_middleware_1.AppError('This file does not match a supported PDF, DOCX, or PPTX document.', 400);
        }
        const course = await db_1.prisma.course.findFirst({
            where: { id: courseId, semester: { userId } },
            select: { id: true },
        });
        if (!course)
            throw new error_middleware_1.AppError('Course not found.', 404);
        let extractedText = '';
        const lowerFileName = file.originalname.toLowerCase();
        if (file.mimetype === 'application/pdf' || lowerFileName.endsWith('.pdf')) {
            const dataBuffer = fs_1.default.readFileSync(file.path);
            const pdfData = await pdfParse(dataBuffer);
            extractedText = pdfData.text;
        }
        else if (lowerFileName.endsWith('.docx')) {
            extractedText = extractOfficeXmlText(fs_1.default.readFileSync(file.path), /^word\/document\.xml$/i);
        }
        else if (lowerFileName.endsWith('.pptx')) {
            extractedText = extractOfficeXmlText(fs_1.default.readFileSync(file.path), /^ppt\/slides\/slide\d+\.xml$/i);
        }
        const materialTitle = typeof title === 'string' && title.trim()
            ? title.trim().slice(0, 200)
            : file.originalname.replace(/\.[^/.]+$/, '').slice(0, 200);
        // Keep extracted text available for processing, but don't label it indexed until embeddings exist.
        const newMaterial = await db_1.prisma.courseMaterial.create({
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
        let isIndexed = false;
        let indexingMessage = null;
        if (extractedText.trim()) {
            try {
                isIndexed = (await indexing_service_1.DocumentIndexingService.indexMaterial(newMaterial.id, newMaterial.title, extractedText)) > 0;
            }
            catch {
                indexingMessage = 'The file was uploaded, but could not be prepared for StudyOS Tutor. You can upload it again later.';
            }
        }
        let extractedAssignment = null;
        let createdAssignment = null;
        if (extractedText) {
            extractedAssignment = await extraction_service_1.DocumentExtractionService.extractAssignmentFromText(newMaterial.id, extractedText);
            if (extractedAssignment) {
                await db_1.prisma.courseMaterial.update({
                    where: { id: newMaterial.id },
                    data: { metadata: { extractedAssignment } },
                });
                if (extractedAssignment.deadline) {
                    const deadline = new Date(extractedAssignment.deadline);
                    const duplicate = await db_1.prisma.assignment.findFirst({
                        where: { courseId, title: extractedAssignment.title, deadline },
                        select: { id: true, title: true },
                    });
                    const assignment = duplicate ?? await db_1.prisma.assignment.create({
                        data: {
                            courseId,
                            title: extractedAssignment.title.slice(0, 200),
                            description: extractedAssignment.description ?? null,
                            deadline,
                            difficulty: extractedAssignment.difficulty,
                            estimatedHours: extractedAssignment.estimatedHours,
                            estimateSource: 'AI_ASSISTANT',
                        },
                        select: { id: true, title: true },
                    });
                    createdAssignment = assignment;
                }
            }
        }
        res.status(201).json({
            success: true,
            message: extractedText ? 'Material uploaded and text extracted.' : 'Material uploaded.',
            data: {
                material: { ...newMaterial, isIndexed },
                extractedTextLength: extractedText.length,
                extractedAssignment,
                assignment: createdAssignment,
                indexingMessage,
            },
        });
    }
    catch (error) {
        if (req.file?.path && fs_1.default.existsSync(req.file.path)) {
            try {
                const referencedMaterial = await db_1.prisma.courseMaterial.findFirst({ where: { fileUrl: req.file.path }, select: { id: true } });
                if (!referencedMaterial)
                    fs_1.default.unlinkSync(req.file.path);
            }
            catch {
                // Keep the original request error while leaving cleanup retryable by an operator.
            }
        }
        next(error);
    }
};
exports.uploadMaterial = uploadMaterial;
const getUserMaterials = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        // Selects only valid fields defined in schema.prisma
        const materials = await db_1.prisma.courseMaterial.findMany({
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
    }
    catch (error) {
        next(error);
    }
};
exports.getUserMaterials = getUserMaterials;
const indexUserMaterial = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            throw new error_middleware_1.AppError('Your session has expired. Sign in and try again.', 401);
        const material = await db_1.prisma.courseMaterial.findFirst({
            where: { id: req.params.id, course: { semester: { userId } } },
            select: { id: true, title: true, extractedText: true, isIndexed: true },
        });
        if (!material)
            throw new error_middleware_1.AppError('This course document could not be found.', 404);
        if (!material.extractedText?.trim())
            throw new error_middleware_1.AppError('This file does not contain readable text for Tutor search.', 400);
        if (material.isIndexed)
            return res.status(200).json({ success: true, data: { material, chunkCount: null } });
        const chunkCount = await indexing_service_1.DocumentIndexingService.indexMaterial(material.id, material.title, material.extractedText);
        return res.status(200).json({
            success: true,
            data: { material: { id: material.id, title: material.title, isIndexed: chunkCount > 0 }, chunkCount },
        });
    }
    catch (error) {
        if (error instanceof ai_provider_interface_1.AIProviderError)
            return next(new error_middleware_1.AppError('Document indexing is temporarily unavailable. Please try again later.', 503));
        if (error instanceof Error && error.message.includes('too large to index')) {
            return next(new error_middleware_1.AppError(error.message, 400));
        }
        return next(error);
    }
};
exports.indexUserMaterial = indexUserMaterial;
const downloadMaterial = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            throw new error_middleware_1.AppError('Unauthorized access', 401);
        const material = await db_1.prisma.courseMaterial.findFirst({
            where: { id: req.params.id, course: { semester: { userId } } },
            select: { fileUrl: true, title: true, fileType: true },
        });
        if (!material)
            throw new error_middleware_1.AppError('Material not found.', 404);
        const uploadRoot = path_1.default.resolve(process.cwd(), 'uploads');
        const filePath = path_1.default.resolve(material.fileUrl);
        if (!filePath.startsWith(`${uploadRoot}${path_1.default.sep}`) || !fs_1.default.existsSync(filePath)) {
            throw new error_middleware_1.AppError('Material file is unavailable.', 404);
        }
        res.download(filePath, path_1.default.basename(filePath), (error) => {
            if (error && !res.headersSent)
                next(error);
        });
    }
    catch (error) {
        next(error);
    }
};
exports.downloadMaterial = downloadMaterial;
