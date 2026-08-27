import { Router } from 'express';
import { onboardUser } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);
router.post('/onboard', onboardUser);

export default router;