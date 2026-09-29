"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseChatAttachment = parseChatAttachment;
const zlib_1 = require("zlib");
const error_middleware_1 = require("../../middleware/error.middleware");
const pdfParse = require('pdf-parse');
function extractOfficeXmlText(buffer) {
    const eocdSignature = 0x06054b50;
    const centralSignature = 0x02014b50;
    const localSignature = 0x04034b50;
    let eocdOffset = -1;
    for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset -= 1) {
        if (buffer.length >= 22 && buffer.readUInt32LE(offset) === eocdSignature) {
            eocdOffset = offset;
            break;
        }
    }
    if (eocdOffset < 0)
        return '';
    const entries = buffer.readUInt16LE(eocdOffset + 10);
    let cursor = buffer.readUInt32LE(eocdOffset + 16);
    const textParts = [];
    let totalBytes = 0;
    for (let index = 0; index < entries && cursor + 46 <= buffer.length; index += 1) {
        if (buffer.readUInt32LE(cursor) !== centralSignature)
            break;
        const method = buffer.readUInt16LE(cursor + 10);
        const compressedSize = buffer.readUInt32LE(cursor + 20);
        const uncompressedSize = buffer.readUInt32LE(cursor + 24);
        const nameLength = buffer.readUInt16LE(cursor + 28);
        const extraLength = buffer.readUInt16LE(cursor + 30);
        const commentLength = buffer.readUInt16LE(cursor + 32);
        const localOffset = buffer.readUInt32LE(cursor + 42);
        const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
        cursor += 46 + nameLength + extraLength + commentLength;
        if (!/^word\/document\.xml$/i.test(name) || uncompressedSize > 20_000_000 || totalBytes + uncompressedSize > 20_000_000 || localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== localSignature)
            continue;
        const dataOffset = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
        const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
        const xml = method === 0 ? compressed.toString('utf8') : method === 8 ? (0, zlib_1.inflateRawSync)(compressed, { maxOutputLength: 20_000_000 }).toString('utf8') : '';
        totalBytes += uncompressedSize;
        if (xml)
            textParts.push(xml);
    }
    return textParts.join('\n').replace(/<\/w:p>/g, '\n').replace(/<w:tab\s*\/>/g, ' ').replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
async function parseChatAttachment(file) {
    const fileName = file.originalname.replace(/[\r\n\\/]/g, '_').slice(0, 180);
    const extension = fileName.split('.').pop()?.toLowerCase();
    const buffer = file.buffer;
    if (extension === 'pdf' && buffer.subarray(0, 4).toString('ascii') === '%PDF') {
        const parsed = await pdfParse(buffer);
        const text = String(parsed.text || '').trim();
        if (!text)
            throw new error_middleware_1.AppError('This PDF has no readable text. Try a clear photo or a text-based PDF.', 400);
        return { fileName, mimeType: 'application/pdf', text: text.slice(0, 60_000) };
    }
    if (extension === 'docx' && buffer[0] === 0x50 && buffer[1] === 0x4b) {
        const text = extractOfficeXmlText(buffer).trim();
        if (!text)
            throw new error_middleware_1.AppError('This DOCX file has no readable text.', 400);
        return { fileName, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', text: text.slice(0, 60_000) };
    }
    const isPng = extension === 'png' && buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = extension === 'jpg' || extension === 'jpeg';
    const isWebp = extension === 'webp' && buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
    if ((isPng || isJpeg || isWebp) && file.mimetype.startsWith('image/')) {
        if (isJpeg && (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff))
            throw new error_middleware_1.AppError('This image file is invalid. Choose a JPG, PNG, or WebP image.', 400);
        return { fileName, mimeType: isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg', imageData: buffer.toString('base64') };
    }
    throw new error_middleware_1.AppError('Choose a valid PDF, DOCX, JPG, PNG, or WebP file.', 400);
}
