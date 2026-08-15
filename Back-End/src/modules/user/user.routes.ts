import { Router } from 'express';
import { onboardUser, getProfile } from './user.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

router.post('/onboard', authenticateToken as any, onboardUser as any);
router.get('/profile', authenticateToken as any, getProfile as any);

export default router;