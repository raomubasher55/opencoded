import { Router } from 'express';
import { LlmController } from '../controllers/llm.controller';
import { authenticateJWT, requireAdmin } from '../middleware/auth.middleware';

const router = Router();

/**
 * Configuration routes
 */
// Get current configuration
router.get('/config', authenticateJWT, LlmController.getConfiguration);

// Update configuration (admin only)
router.post('/config', authenticateJWT, requireAdmin, LlmController.configureProvider);

/**
 * Provider and model routes
 */
// Get available providers
router.get('/providers', authenticateJWT, LlmController.getProviders);

// Get available models for current provider
router.get('/models', authenticateJWT, LlmController.getModels);

/**
 * Completion routes
 */
// Create a completion
router.post('/completions', authenticateJWT, LlmController.createCompletion);

// Create a streaming completion
router.post('/completions/stream', authenticateJWT, LlmController.createStreamingCompletion);

// Count tokens
router.post('/tokens/count', authenticateJWT, LlmController.countTokens);

/**
 * Template routes
 */
// Get all templates
router.get('/templates', authenticateJWT, LlmController.getTemplates);

// Get a specific template
router.get('/templates/:name', authenticateJWT, LlmController.getTemplate);

// Create or update a template (admin only)
router.post('/templates/:name', authenticateJWT, requireAdmin, LlmController.saveTemplate);

// Delete a template (admin only)
router.delete('/templates/:name', authenticateJWT, requireAdmin, LlmController.deleteTemplate);

// Render a template
router.post('/templates/:name/render', authenticateJWT, LlmController.renderTemplate);

export default router;