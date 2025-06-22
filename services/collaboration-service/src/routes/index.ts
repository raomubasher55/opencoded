import { Router } from 'express';
import { sessionRoutes } from './session.routes';
import { chatRoutes } from './chat.routes';
import { workspaceRoutes } from './workspace.routes';
import commentRoutes from './comment.routes';
import threadRoutes from './thread.routes';
import reviewRequestRoutes from './review-request.routes';

const router = Router();

// Mount routes
router.use('/sessions', sessionRoutes);
router.use('/chat', chatRoutes);
router.use('/workspaces', workspaceRoutes);
router.use('/comments', commentRoutes);
router.use('/threads', threadRoutes);
router.use('/reviews', reviewRequestRoutes);

export { router as collaborationRoutes };