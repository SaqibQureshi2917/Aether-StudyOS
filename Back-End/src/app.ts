import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './modules/auth/auth.routes';

dotenv.config();

const app: Application = express();


const rawOrigins = process.env.CORS_ORIGIN || 'http://localhost:3000';
const allowedOrigins = rawOrigins.split(',').map((url) => url.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Postman / Server-to-Server requests ya allowed frontend domains
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS Error: Origin ${origin} not allowed.`));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// Routes
app.use('/api/v1/auth', authRoutes);

app.get('/', (req, res) => {
  res.status(200).json({
    message: '🚀 Aether StudyOS Express Backend Server is Live!',
    health: '/health',
    version: '1.0.0',
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

export default app;