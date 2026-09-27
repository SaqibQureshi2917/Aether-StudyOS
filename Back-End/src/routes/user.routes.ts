import { Router } from 'express';
import { onboardUser, updateUserProfile } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.post('/onboard', onboardUser);
router.patch('/profile', updateUserProfile);

export default router;
