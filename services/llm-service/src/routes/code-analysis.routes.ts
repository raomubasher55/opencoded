import { Router } from 'express';
import { CodeAnalysisController } from '../controllers/code-analysis.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { LlmService } from '../services/llm.service';
import { PromptTemplateService } from '../services/prompt-template.service';

const router = Router();
const llmService = new LlmService();
const promptTemplateService = new PromptTemplateService();
const codeAnalysisController = new CodeAnalysisController(llmService, promptTemplateService);

/**
 * @route POST /api/code-analysis/documentation
 * @desc Generate documentation for code
 * @access Private
 */
router.post('/documentation', authenticateJWT, (req, res) => 
  codeAnalysisController.generateDocumentation(req, res));

/**
 * @route POST /api/code-analysis/tests
 * @desc Generate tests for code
 * @access Private
 */
router.post('/tests', authenticateJWT, (req, res) => 
  codeAnalysisController.generateTests(req, res));

/**
 * @route POST /api/code-analysis/security
 * @desc Analyze code for security issues
 * @access Private
 */
router.post('/security', authenticateJWT, (req, res) => 
  codeAnalysisController.analyzeSecurity(req, res));

/**
 * @route POST /api/code-analysis/improvements
 * @desc Suggest code improvements
 * @access Private
 */
router.post('/improvements', authenticateJWT, (req, res) => 
  codeAnalysisController.suggestImprovements(req, res));

/**
 * @route POST /api/code-analysis/refactor
 * @desc Refactor code
 * @access Private
 */
router.post('/refactor', authenticateJWT, (req, res) => 
  codeAnalysisController.refactorCode(req, res));

/**
 * @route POST /api/code-analysis/explain
 * @desc Explain code
 * @access Private
 */
router.post('/explain', authenticateJWT, (req, res) => 
  codeAnalysisController.explainCode(req, res));

/**
 * @route POST /api/code-analysis/project
 * @desc Analyze project structure
 * @access Private
 */
router.post('/project', authenticateJWT, (req, res) => 
  codeAnalysisController.analyzeProjectStructure(req, res));

/**
 * @route POST /api/code-analysis/generate
 * @desc Generate code from description
 * @access Private
 */
router.post('/generate', authenticateJWT, (req, res) => 
  codeAnalysisController.generateCode(req, res));

export default router;