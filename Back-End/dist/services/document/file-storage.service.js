"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileStorageService = void 0;
const crypto_1 = require("crypto");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const error_middleware_1 = require("../../middleware/error.middleware");
const env_1 = require("../../config/env");
const localRoot = path_1.default.resolve(process.env.FILE_STORAGE_DIR || path_1.default.join(process.cwd(), '.local-data', 'materials'));
const s3Configured = Boolean(env_1.ENV.S3_ENDPOINT && env_1.ENV.S3_BUCKET && env_1.ENV.S3_ACCESS_KEY_ID && env_1.ENV.S3_SECRET_ACCESS_KEY);
const region = env_1.ENV.S3_REGION || 'auto';
function hmac(key, value, encoding) {
    const digest = (0, crypto_1.createHmac)('sha256', key).update(value);
    return encoding ? digest.digest(encoding) : digest.digest();
}
function s3Request(method, key, body, contentType) {
    if (!s3Configured)
        throw new error_middleware_1.AppError('Secure object storage is not configured.', 503);
    const base = env_1.ENV.S3_ENDPOINT.replace(/\/+$/, '');
    const objectPath = `${base}/${encodeURIComponent(env_1.ENV.S3_BUCKET)}/${key.split('/').map(encodeURIComponent).join('/')}`;
    const url = new URL(objectPath);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = (0, crypto_1.createHash)('sha256').update(body || Buffer.alloc(0)).digest('hex');
    const headers = {
        host: url.host,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
    };
    if (contentType)
        headers['content-type'] = contentType;
    const signedHeaders = Object.keys(headers).sort().join(';');
    const canonicalHeaders = Object.keys(headers).sort().map((name) => `${name}:${headers[name].trim()}\n`).join('');
    const canonicalRequest = [method, url.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const scope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, (0, crypto_1.createHash)('sha256').update(canonicalRequest).digest('hex')].join('\n');
    const dateKey = hmac(`AWS4${env_1.ENV.S3_SECRET_ACCESS_KEY}`, dateStamp);
    const regionKey = hmac(dateKey, region);
    const serviceKey = hmac(regionKey, 's3');
    const signingKey = hmac(serviceKey, 'aws4_request');
    const signature = hmac(signingKey, stringToSign, 'hex');
    return fetch(url, {
        method,
        headers: {
            ...headers,
            Authorization: `AWS4-HMAC-SHA256 Credential=${env_1.ENV.S3_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        },
        ...(body ? { body: new Uint8Array(body) } : {}),
        signal: AbortSignal.timeout(20_000),
    });
}
async function localPath(key) {
    const fullPath = path_1.default.resolve(localRoot, key);
    if (!fullPath.startsWith(`${localRoot}${path_1.default.sep}`))
        throw new error_middleware_1.AppError('Invalid stored file reference.', 400);
    return fullPath;
}
class FileStorageService {
    static async store(userId, courseId, originalName, contentType, data) {
        const extension = path_1.default.extname(originalName).toLowerCase();
        const key = `${userId}/${courseId}/${(0, crypto_1.randomUUID)()}${extension}`;
        if (s3Configured) {
            const response = await s3Request('PUT', key, data, contentType);
            if (!response.ok)
                throw new error_middleware_1.AppError('The file could not be saved to secure storage.', 502);
        }
        else {
            if (env_1.ENV.NODE_ENV === 'production')
                throw new error_middleware_1.AppError('Secure object storage is not configured.', 503);
            const destination = await localPath(key);
            await promises_1.default.mkdir(path_1.default.dirname(destination), { recursive: true, mode: 0o700 });
            await promises_1.default.writeFile(destination, data, { mode: 0o600 });
        }
        return key;
    }
    static async read(key) {
        if (s3Configured) {
            const response = await s3Request('GET', key);
            if (response.status === 404)
                throw new error_middleware_1.AppError('Material file is unavailable.', 404);
            if (!response.ok)
                throw new error_middleware_1.AppError('Material file could not be retrieved from secure storage.', 502);
            return Buffer.from(await response.arrayBuffer());
        }
        if (env_1.ENV.NODE_ENV === 'production')
            throw new error_middleware_1.AppError('Secure object storage is not configured.', 503);
        try {
            return await promises_1.default.readFile(await localPath(key));
        }
        catch (error) {
            if (error?.code === 'ENOENT')
                throw new error_middleware_1.AppError('Material file is unavailable.', 404);
            throw error;
        }
    }
    static async remove(key) {
        if (s3Configured) {
            const response = await s3Request('DELETE', key);
            if (!response.ok && response.status !== 404)
                throw new error_middleware_1.AppError('The file could not be removed from secure storage.', 502);
            return;
        }
        if (env_1.ENV.NODE_ENV === 'production')
            throw new error_middleware_1.AppError('Secure object storage is not configured.', 503);
        try {
            await promises_1.default.unlink(await localPath(key));
        }
        catch (error) {
            if (error?.code !== 'ENOENT')
                throw error;
        }
    }
}
exports.FileStorageService = FileStorageService;
