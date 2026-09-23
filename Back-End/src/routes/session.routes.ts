
import { Router } from 'express';
import { 
  startSession, 
  completeSession, 
  markSessionMissed 
} from '../controllers/session.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/start', authenticate, startSession);
router.post('/complete', authenticate, completeSession);
router.post('/missed', authenticate, markSessionMissed);

export default router;