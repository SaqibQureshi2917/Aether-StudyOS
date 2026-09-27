import express, { Application } from 'express';
import cors from 'cors';
import { ENV } from './config/env';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import onboardingRouter from './routes/onboarding.routes';
import dashboardRoutes from './routes/dashboard.routes';
import courseRoutes from './routes/course.routes';
import assignmentRoutes from './routes/assignment.routes';
import materialRoutes from './routes/material.routes';
import { errorHandler } from './middleware/error.middleware';
import chatRoutes from './routes/chat.routes';
import plannerRoutes from './routes/planner.routes';
import sessionRoutes from './routes/session.routes';
import recommendationRoutes from './routes/recommendation.routes';
import semesterRoutes from './routes/semester.routes';

const app: Application = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ENV.CORS_ORIGINS.includes(origin) && req.headers['access-control-request-private-network'] === 'true') {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});
app.use(cors({ origin: ENV.CORS_ORIGINS, credentials: true }));
app.use(express.json());


// Routes Mounting
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/user', onboardingRouter);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/semesters', semesterRoutes);
app.use('/api/v1/assignments', assignmentRoutes);
app.use('/api/v1/materials', materialRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/planner', plannerRoutes);
app.use('/api/v1/sessions', sessionRoutes);
app.use('/api/v1/recommendations', recommendationRoutes);

app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Aether Engine Active' });
});

app.use(errorHandler);

export default app;
