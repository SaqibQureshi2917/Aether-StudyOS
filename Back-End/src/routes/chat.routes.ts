import { Router } from 'express';
import { handleChatRequest } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth.middleware';
const router = Router();
router.post('/', authenticate, handleChatRequest);

export default router;
