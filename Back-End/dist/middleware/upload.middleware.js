"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const error_middleware_1 = require("./error.middleware");
const path_1 = __importDefault(require("path"));
// File Filter (Only PDF, DOCX, PPTX allowed)
const fileFilter = (_req, file, cb) => {
    const extension = path_1.default.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.pdf', '.docx', '.pptx', '.txt'];
    if (allowedExtensions.includes(extension)) {
        cb(null, true);
    }
    else {
        cb(new error_middleware_1.AppError('Choose a PDF, DOCX, PPTX, or TXT file.', 400), false);
    }
};
exports.upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    fileFilter,
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});
