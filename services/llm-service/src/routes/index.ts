import { Router } from 'express';
import llmRoutes from './llm.routes';
import codeReviewRoutes from './code-review.routes';

const router = Router();

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'llm-service' });
});

// Mount routes
router.use('/api/llm', llmRoutes);
router.use('/api/llm', codeReviewRoutes);

export default router;