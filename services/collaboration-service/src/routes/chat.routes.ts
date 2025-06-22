import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { 
  getMessages,
  getMessageById,
  createMessage,
  deleteMessage,
  getThreadMessages
} from '../controllers/chat.controller';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// Chat message routes
router.get('/sessions/:sessionId/messages', getMessages);
router.get('/messages/:id', getMessageById);
router.post('/sessions/:sessionId/messages', createMessage);
router.delete('/messages/:id', deleteMessage);
router.get('/messages/:id/thread', getThreadMessages);

export { router as chatRoutes };