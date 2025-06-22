import { Request, Response } from 'express';
import { CodeAnalysisService } from '../services/code-analysis.service';
import { LlmService } from '../services/llm.service';
import { PromptTemplateService } from '../services/prompt-template.service';

/**
 * Controller for code analysis and AI-enhanced capabilities
 */
export class CodeAnalysisController {
  private codeAnalysisService: CodeAnalysisService;
  
  constructor(
    private llmService: LlmService,
    private promptTemplateService: PromptTemplateService
  ) {
    this.codeAnalysisService = new CodeAnalysisService(llmService, promptTemplateService);
  }
  
  /**
   * Generate documentation for code
   */
  async generateDocumentation(req: Request, res: Response): Promise<void> {
    try {
      const { code, language } = req.body;
      
      if (!code || !language) {
        res.status(400).json({
          success: false,
          message: 'Code and language are required'
        });
        return;
      }
      
      const documentation = await this.codeAnalysisService.generateDocumentation(code, language);
      
      res.json({
        success: true,
        data: { documentation }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error generating documentation'
      });
    }
  }
  
  /**
   * Generate tests for code
   */
  async generateTests(req: Request, res: Response): Promise<void> {
    try {
      const { code, language, testFramework } = req.body;
      
      if (!code || !language) {
        res.status(400).json({
          success: false,
          message: 'Code and language are required'
        });
        return;
      }
      
      const tests = await this.codeAnalysisService.generateTests(code, language, testFramework);
      
      res.json({
        success: true,
        data: { tests }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error generating tests'
      });
    }
  }
  
  /**
   * Analyze code for security issues
   */
  async analyzeSecurity(req: Request, res: Response): Promise<void> {
    try {
      const { code, language } = req.body;
      
      if (!code || !language) {
        res.status(400).json({
          success: false,
          message: 'Code and language are required'
        });
        return;
      }
      
      const securityAnalysis = await this.codeAnalysisService.analyzeSecurity(code, language);
      
      res.json({
        success: true,
        data: securityAnalysis
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error analyzing security'
      });
    }
  }
  
  /**
   * Suggest code improvements
   */
  async suggestImprovements(req: Request, res: Response): Promise<void> {
    try {
      const { code, language, focus } = req.body;
      
      if (!code || !language) {
        res.status(400).json({
          success: false,
          message: 'Code and language are required'
        });
        return;
      }
      
      const improvements = await this.codeAnalysisService.suggestImprovements(
        code, 
        language,
        focus
      );
      
      res.json({
        success: true,
        data: improvements
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error suggesting improvements'
      });
    }
  }
  
  /**
   * Refactor code
   */
  async refactorCode(req: Request, res: Response): Promise<void> {
    try {
      const { code, language, objectives } = req.body;
      
      if (!code || !language || !objectives) {
        res.status(400).json({
          success: false,
          message: 'Code, language, and objectives are required'
        });
        return;
      }
      
      const refactoring = await this.codeAnalysisService.refactorCode(
        code,
        language,
        Array.isArray(objectives) ? objectives : [objectives]
      );
      
      res.json({
        success: true,
        data: refactoring
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error refactoring code'
      });
    }
  }
  
  /**
   * Explain code
   */
  async explainCode(req: Request, res: Response): Promise<void> {
    try {
      const { code, language } = req.body;
      
      if (!code || !language) {
        res.status(400).json({
          success: false,
          message: 'Code and language are required'
        });
        return;
      }
      
      const explanation = await this.codeAnalysisService.explainCode(code, language);
      
      res.json({
        success: true,
        data: explanation
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error explaining code'
      });
    }
  }
  
  /**
   * Analyze project structure
   */
  async analyzeProjectStructure(req: Request, res: Response): Promise<void> {
    try {
      const { projectFiles, selectedFiles } = req.body;
      
      if (!projectFiles || !Array.isArray(projectFiles) || !selectedFiles) {
        res.status(400).json({
          success: false,
          message: 'Project files array and selected files object are required'
        });
        return;
      }
      
      const analysis = await this.codeAnalysisService.analyzeProjectStructure(
        projectFiles,
        selectedFiles
      );
      
      res.json({
        success: true,
        data: analysis
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error analyzing project structure'
      });
    }
  }
  
  /**
   * Generate code from description
   */
  async generateCode(req: Request, res: Response): Promise<void> {
    try {
      const { description, language, context } = req.body;
      
      if (!description || !language) {
        res.status(400).json({
          success: false,
          message: 'Description and language are required'
        });
        return;
      }
      
      const generated = await this.codeAnalysisService.generateCode(
        description,
        language,
        context
      );
      
      res.json({
        success: true,
        data: generated
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: error.message || 'Error generating code'
      });
    }
  }
}

export default CodeAnalysisController;