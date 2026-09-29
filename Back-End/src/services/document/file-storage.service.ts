import { createHash, createHmac, randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { AppError } from '../../middleware/error.middleware';
import { ENV } from '../../config/env';

const localRoot = path.resolve(process.env.FILE_STORAGE_DIR || path.join(process.cwd(), '.local-data', 'materials'));
const s3Configured = Boolean(ENV.S3_ENDPOINT && ENV.S3_BUCKET && ENV.S3_ACCESS_KEY_ID && ENV.S3_SECRET_ACCESS_KEY);
const region = ENV.S3_REGION || 'auto';

function hmac(key: Buffer | string, value: string): Buffer;
function hmac(key: Buffer | string, value: string, encoding: 'hex'): string;
function hmac(key: Buffer | string, value: string, encoding?: 'hex'): Buffer | string {
  const digest = createHmac('sha256', key).update(value);
  return encoding ? digest.digest(encoding) : digest.digest();
}

function s3Request(method: string, key: string, body?: Buffer, contentType?: string) {
  if (!s3Configured) throw new AppError('Secure object storage is not configured.', 503);
  const base = ENV.S3_ENDPOINT!.replace(/\/+$/, '');
  const objectPath = `${base}/${encodeURIComponent(ENV.S3_BUCKET!)}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const url = new URL(objectPath);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = createHash('sha256').update(body || Buffer.alloc(0)).digest('hex');
  const headers: Record<string, string> = {
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  if (contentType) headers['content-type'] = contentType;
  const signedHeaders = Object.keys(headers).sort().join(';');
  const canonicalHeaders = Object.keys(headers).sort().map((name) => `${name}:${headers[name].trim()}\n`).join('');
  const canonicalRequest = [method, url.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
  const dateKey = hmac(`AWS4${ENV.S3_SECRET_ACCESS_KEY}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, 's3');
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = hmac(signingKey, stringToSign, 'hex');
  return fetch(url, {
    method,
    headers: {
      ...headers,
      Authorization: `AWS4-HMAC-SHA256 Credential=${ENV.S3_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    ...(body ? { body: new Uint8Array(body) } : {}),
    signal: AbortSignal.timeout(20_000),
  });
}

async function localPath(key: string) {
  const fullPath = path.resolve(localRoot, key);
  if (!fullPath.startsWith(`${localRoot}${path.sep}`)) throw new AppError('Invalid stored file reference.', 400);
  return fullPath;
}

export class FileStorageService {
  static async store(userId: string, courseId: string, originalName: string, contentType: string, data: Buffer) {
    const extension = path.extname(originalName).toLowerCase();
    const key = `${userId}/${courseId}/${randomUUID()}${extension}`;
    if (s3Configured) {
      const response = await s3Request('PUT', key, data, contentType);
      if (!response.ok) throw new AppError('The file could not be saved to secure storage.', 502);
    } else {
      if (ENV.NODE_ENV === 'production') throw new AppError('Secure object storage is not configured.', 503);
      const destination = await localPath(key);
      await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
      await fs.writeFile(destination, data, { mode: 0o600 });
    }
    return key;
  }

  static async read(key: string) {
    if (s3Configured) {
      const response = await s3Request('GET', key);
      if (response.status === 404) throw new AppError('Material file is unavailable.', 404);
      if (!response.ok) throw new AppError('Material file could not be retrieved from secure storage.', 502);
      return Buffer.from(await response.arrayBuffer());
    }
    if (ENV.NODE_ENV === 'production') throw new AppError('Secure object storage is not configured.', 503);
    try { return await fs.readFile(await localPath(key)); }
    catch (error: any) { if (error?.code === 'ENOENT') throw new AppError('Material file is unavailable.', 404); throw error; }
  }

  static async remove(key: string) {
    if (s3Configured) {
      const response = await s3Request('DELETE', key);
      if (!response.ok && response.status !== 404) throw new AppError('The file could not be removed from secure storage.', 502);
      return;
    }
    if (ENV.NODE_ENV === 'production') throw new AppError('Secure object storage is not configured.', 503);
    try { await fs.unlink(await localPath(key)); }
    catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
  }
}
