import { Router } from 'express';
import { getDashboardOverview } from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// GET /api/v1/dashboard/overview
router.get('/overview', getDashboardOverview);

export default router;