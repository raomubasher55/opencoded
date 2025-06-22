import { Router } from 'express';
import sessionRoutes from './session.routes';

const router = Router();

// Health check route
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'session-service' });
});

// Mount routes
router.use('/api/sessions', sessionRoutes);

export default router;