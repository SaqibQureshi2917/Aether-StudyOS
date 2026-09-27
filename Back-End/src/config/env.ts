import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const jwtSecret = process.env.JWT_SECRET?.trim();
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters.');
}

export const ENV = {
  PORT: process.env.PORT || '5000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || '',
  CORS_ORIGINS: [...new Set([
    'http://localhost:3000',
    'https://aether-study-os.vercel.app',
    ...(process.env.CORS_ORIGIN || '').split(',').map((origin) => origin.trim()).filter(Boolean),
  ])],
  JWT_SECRET: jwtSecret,
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
};
