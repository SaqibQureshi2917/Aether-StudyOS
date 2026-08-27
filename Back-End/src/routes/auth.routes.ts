import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public Routes
router.post('/register', register);
router.post('/login', login);

// Protected Routes
router.get('/me', authenticate, getMe);

export default router;