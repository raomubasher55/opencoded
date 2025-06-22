import { Router } from 'express';
import { SessionController } from '../controllers/session.controller';
import { authenticateJWT, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT);

/**
 * Session management routes
 */
// Get all sessions for the authenticated user
router.get('/', SessionController.getAllSessions);

// Create a new session
router.post('/', SessionController.createSession);

// Get a specific session
router.get('/:sessionId', SessionController.getSession);

// Update a session
router.patch('/:sessionId', SessionController.updateSession);

// Delete a session
router.delete('/:sessionId', SessionController.deleteSession);

/**
 * Message management routes
 */
// Get messages from a session
router.get('/:sessionId/messages', SessionController.getMessages);

// Add a message to a session
router.post('/:sessionId/messages', SessionController.addMessage);

// Delete a message from a session
router.delete('/:sessionId/messages/:messageId', SessionController.deleteMessage);

/**
 * Admin-only routes
 */
// Clear old sessions (admin only)
router.post('/maintenance/clear-old', requireAdmin, SessionController.clearOldSessions);

export default router;