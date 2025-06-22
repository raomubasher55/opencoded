import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { 
  createSession, 
  getSessions, 
  getSessionById,
  updateSession,
  deleteSession,
  joinSession,
  leaveSession,
  getActiveParticipants
} from '../controllers/session.controller';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

// Session routes
router.post('/', createSession);
router.get('/', getSessions);
router.get('/:id', getSessionById);
router.put('/:id', updateSession);
router.delete('/:id', deleteSession);

// Participant management
router.post('/:id/join', joinSession);
router.post('/:id/leave', leaveSession);
router.get('/:id/participants', getActiveParticipants);

export { router as sessionRoutes };