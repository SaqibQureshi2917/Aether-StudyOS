import { Router } from 'express';
import { handleChatRequest } from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth.middleware';
import multer from 'multer';
const upload = multer({ dest: 'uploads/' });
const router = Router();
router.post('/', authenticate, upload.single('file'), handleChatRequest);

router.post('/', authenticate, handleChatRequest);

export default router;