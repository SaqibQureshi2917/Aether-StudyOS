import { Router } from 'express';
import { handleChatMessage } from './chat.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();
router.use(authenticate);
router.post('/', handleChatMessage);

export default router;