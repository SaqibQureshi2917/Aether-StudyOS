import { Router } from 'express';
import { generatePlannerSchedule } from '../controllers/planner.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
router.post('/generate', authenticate, generatePlannerSchedule);

export default router;