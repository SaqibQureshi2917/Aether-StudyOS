import { Router } from 'express';
import { register, login, getMe, logout, requestPasswordReset, resetPassword } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public Routes
router.post('/register', register);
router.post('/login', login);
router.post('/password-reset/request', requestPasswordReset);
router.post('/password-reset/confirm', resetPassword);

// Protected Routes
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

export default router;
