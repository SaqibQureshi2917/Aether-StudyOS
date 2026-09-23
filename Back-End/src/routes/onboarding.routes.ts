import { Router } from 'express';
import { completeOnboarding } from '../controllers/onboarding.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);


router.post('/onboarding', completeOnboarding);

export default router;