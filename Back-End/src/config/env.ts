import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const ENV = {
  PORT: process.env.PORT || '5000',
  NODE_ENV: process.env.NODE_ENV || 'development',
  DATABASE_URL: process.env.DATABASE_URL || '',
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  JWT_SECRET: process.env.JWT_SECRET || 'aether_secret',
};