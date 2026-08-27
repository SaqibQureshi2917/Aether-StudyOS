import { Router } from 'express';
import { handleChatMessage, getUserChatThreads } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

router.post('/', handleChatMessage);
router.get('/threads', getUserChatThreads);

export default router;