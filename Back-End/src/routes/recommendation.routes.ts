// backend/src/routes/recommendation.routes.ts
import { Router } from 'express';
import { acceptRecommendation } from '../controllers/recommendation.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Endpoint to accept a recommendation and trigger deterministic plan update
router.post('/:recommendationId/accept', authenticate, acceptRecommendation);

export default router;