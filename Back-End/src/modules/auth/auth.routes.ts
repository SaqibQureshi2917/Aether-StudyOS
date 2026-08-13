import { Router } from 'express';
import { register, login, getMe } from './auth.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateToken as any, getMe as any);

export default router;