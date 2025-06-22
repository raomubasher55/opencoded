import express from 'express';
import { CommentController } from '../controllers/comment.controller';
import { authenticateJWT as authMiddleware } from '../middleware/auth.middleware';

const router = express.Router();
const commentController = new CommentController();

// Create a new comment
router.post(
  '/',
  authMiddleware,
  commentController.createComment.bind(commentController)
);

// Get comments for a file
router.get(
  '/file/:sessionId/:fileId',
  authMiddleware,
  commentController.getFileComments.bind(commentController)
);

// Get comments in a thread
router.get(
  '/thread/:threadId',
  authMiddleware,
  commentController.getThreadComments.bind(commentController)
);

// Update a comment
router.put(
  '/:commentId',
  authMiddleware,
  commentController.updateComment.bind(commentController)
);

// Delete a comment
router.delete(
  '/:commentId',
  authMiddleware,
  commentController.deleteComment.bind(commentController)
);

export default router;