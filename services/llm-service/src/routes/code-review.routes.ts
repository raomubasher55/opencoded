import { Router } from 'express';
import { CodeReviewController } from '../controllers/code-review.controller';
import { LlmService } from '../services/llm.service';
import { TeamContextService } from '../services/team-context.service';
import { PromptTemplateService } from '../services/prompt-template.service';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Initialize services
const llmService = new LlmService();
const teamContextService = new TeamContextService();
const promptTemplateService = new PromptTemplateService();

// Initialize controller
const codeReviewController = new CodeReviewController(
  llmService,
  teamContextService,
  promptTemplateService
);

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Routes
router.post('/code-review', codeReviewController.reviewCode);
router.post('/code-review/file', codeReviewController.reviewFile);
router.get('/code-review/stats', codeReviewController.getReviewStats);
router.get('/code-review/:reviewId', codeReviewController.getReview);
router.post('/code-review/:reviewId/auto-fix', codeReviewController.autoFixIssues);

export default router;