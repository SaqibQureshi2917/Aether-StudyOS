"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatAttachmentUpload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const error_middleware_1 = require("./error.middleware");
const allowedExtensions = new Set(['.pdf', '.docx', '.jpg', '.jpeg', '.png', '.webp']);
exports.chatAttachmentUpload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    fileFilter: (_req, file, callback) => {
        if (!allowedExtensions.has(path_1.default.extname(file.originalname).toLowerCase())) {
            callback(new error_middleware_1.AppError('Choose a PDF, DOCX, JPG, PNG, or WebP file.', 400));
            return;
        }
        callback(null, true);
    },
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});
