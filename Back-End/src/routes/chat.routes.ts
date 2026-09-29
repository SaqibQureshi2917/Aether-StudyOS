import { Router } from 'express';
import {
  deleteConversation,
  createConversation,
  getConversation,
  getConversationThreads,
  handleChatRequest,
  regenerateConversationReply,
  renameConversation,
} from '../controllers/chat.controller';
import { authenticate } from '../middleware/auth.middleware';
import { limitChatRequests } from '../middleware/chat-rate-limit.middleware';
import { chatAttachmentUpload } from '../middleware/chat-attachment.middleware';

const router = Router();
router.use(authenticate);
router.get('/threads', getConversationThreads);
router.post('/threads', createConversation);
router.get('/threads/:conversationId', getConversation);
router.patch('/threads/:conversationId', renameConversation);
router.delete('/threads/:conversationId', deleteConversation);
router.post('/threads/:conversationId/regenerate', limitChatRequests, regenerateConversationReply);
router.post('/', limitChatRequests, chatAttachmentUpload.single('attachment'), handleChatRequest);

export default router;
