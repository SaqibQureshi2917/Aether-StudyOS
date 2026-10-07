import { Router } from 'express';
import { applyPlannerSchedule, explainPlannerWorkload, getPlannerAvailability, getPlannerOverview, getPlannerSessions, previewPlannerSchedule, replacePlannerAvailability } from '../controllers/planner.controller';
import { authenticate } from '../middleware/auth.middleware';
import { limitChatRequests } from '../middleware/chat-rate-limit.middleware';

const router = Router();
router.get('/overview', authenticate, getPlannerOverview);
router.get('/sessions', authenticate, getPlannerSessions);
router.get('/availability', authenticate, getPlannerAvailability);
router.put('/availability', authenticate, replacePlannerAvailability);
router.post('/preview', authenticate, previewPlannerSchedule);
router.post('/apply', authenticate, applyPlannerSchedule);
router.post('/explain', authenticate, limitChatRequests, explainPlannerWorkload);
// Backwards-compatible endpoint: generation now previews and requires explicit confirmation via /apply.
router.post('/generate', authenticate, previewPlannerSchedule);

export default router;
