
import { Router } from 'express';
import { 
  startSession, 
  completeSession, 
  markSessionMissed,
  pauseSession,
  resumeSession,
  getActiveSession,
} from '../controllers/session.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/start', authenticate, startSession);
router.post('/complete', authenticate, completeSession);
router.post('/missed', authenticate, markSessionMissed);
router.post('/pause', authenticate, pauseSession);
router.post('/resume', authenticate, resumeSession);
router.get('/active', authenticate, getActiveSession);

export default router;
