import express from 'express';
import { ThreadController } from '../controllers/thread.controller';
import { authenticateJWT as authMiddleware } from '../middleware/auth.middleware';

const router = express.Router();
const threadController = new ThreadController();

// Create a new thread
router.post(
  '/',
  authMiddleware,
  threadController.createThread.bind(threadController)
);

// Get threads for a session
router.get(
  '/session/:sessionId',
  authMiddleware,
  threadController.getSessionThreads.bind(threadController)
);

// Get threads for a file
router.get(
  '/file/:sessionId/:fileId',
  authMiddleware,
  threadController.getFileThreads.bind(threadController)
);

// Get a thread with its comments
router.get(
  '/:threadId',
  authMiddleware,
  threadController.getThreadWithComments.bind(threadController)
);

// Update a thread
router.put(
  '/:threadId',
  authMiddleware,
  threadController.updateThread.bind(threadController)
);

// Delete a thread
router.delete(
  '/:threadId',
  authMiddleware,
  threadController.deleteThread.bind(threadController)
);

export default router;