import { Request, Response } from 'express';
import { CodeReviewService, CodeChange, ReviewContext } from '../services/code-review.service';
import { LlmService } from '../services/llm.service';
import { TeamContextService } from '../services/team-context.service';
import { PromptTemplateService } from '../services/prompt-template.service';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('code-review-controller');

export class CodeReviewController {
  private codeReviewService: CodeReviewService;

  constructor(
    llmService: LlmService,
    teamContextService: TeamContextService,
    promptTemplateService: PromptTemplateService
  ) {
    this.codeReviewService = new CodeReviewService(
      llmService,
      teamContextService,
      promptTemplateService
    );
  }

  /**
   * Review code changes
   * POST /api/llm/code-review
   */
  public reviewCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const { changes, context } = req.body;

      // Validate input
      if (!changes || !Array.isArray(changes)) {
        res.status(400).json({
          success: false,
          message: 'Changes array is required'
        });
        return;
      }

      if (!context || !context.author) {
        res.status(400).json({
          success: false,
          message: 'Review context with author is required'
        });
        return;
      }

      // Validate changes format
      const validatedChanges: CodeChange[] = changes.map((change: any, index: number) => {
        if (!change.file || !change.diff) {
          throw new Error(`Invalid change at index ${index}: file and diff are required`);
        }

        return {
          file: change.file,
          type: change.type || 'modified',
          diff: change.diff,
          additions: change.additions || 0,
          deletions: change.deletions || 0,
          language: change.language
        };
      });

      // Validate context
      const reviewContext: ReviewContext = {
        pullRequestId: context.pullRequestId,
        commitId: context.commitId,
        author: context.author,
        timestamp: context.timestamp ? new Date(context.timestamp) : new Date(),
        description: context.description,
        branch: context.branch || 'unknown',
        baseBranch: context.baseBranch || 'main',
        teamId: context.teamId,
        sessionId: context.sessionId
      };

      logger.info(`Starting code review for ${validatedChanges.length} files by ${reviewContext.author}`);

      // Perform the review
      const reviewResult = await this.codeReviewService.reviewChanges(
        validatedChanges,
        reviewContext
      );

      // Return results
      res.json({
        success: true,
        data: reviewResult
      });

    } catch (error) {
      logger.error('Failed to review code', error);
      res.status(500).json({
        success: false,
        message: 'Failed to review code changes',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get review by ID
   * GET /api/llm/code-review/:reviewId
   */
  public getReview = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reviewId } = req.params;

      if (!reviewId) {
        res.status(400).json({
          success: false,
          message: 'Review ID is required'
        });
        return;
      }

      const review = await this.codeReviewService.getReview(reviewId);

      if (!review) {
        res.status(404).json({
          success: false,
          message: 'Review not found'
        });
        return;
      }

      res.json({
        success: true,
        data: review
      });

    } catch (error) {
      logger.error('Failed to get review', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve review',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Auto-fix issues
   * POST /api/llm/code-review/:reviewId/auto-fix
   */
  public autoFixIssues = async (req: Request, res: Response): Promise<void> => {
    try {
      const { reviewId } = req.params;
      const { issueIds } = req.body;

      if (!reviewId) {
        res.status(400).json({
          success: false,
          message: 'Review ID is required'
        });
        return;
      }

      if (!issueIds || !Array.isArray(issueIds)) {
        res.status(400).json({
          success: false,
          message: 'Issue IDs array is required'
        });
        return;
      }

      const fixResult = await this.codeReviewService.autoFixIssues(reviewId, issueIds);

      res.json({
        success: true,
        data: fixResult
      });

    } catch (error) {
      logger.error('Failed to auto-fix issues', error);
      res.status(500).json({
        success: false,
        message: 'Failed to auto-fix issues',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Review single file
   * POST /api/llm/code-review/file
   */
  public reviewFile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { file, diff, context } = req.body;

      if (!file || !diff) {
        res.status(400).json({
          success: false,
          message: 'File path and diff are required'
        });
        return;
      }

      if (!context || !context.author) {
        res.status(400).json({
          success: false,
          message: 'Review context with author is required'
        });
        return;
      }

      // Create single change
      const changes: CodeChange[] = [{
        file,
        type: 'modified',
        diff,
        additions: (diff.match(/^\+/gm) || []).length,
        deletions: (diff.match(/^\-/gm) || []).length,
        language: this.detectLanguage(file)
      }];

      // Create context
      const reviewContext: ReviewContext = {
        author: context.author,
        timestamp: new Date(),
        description: context.description,
        branch: context.branch || 'unknown',
        baseBranch: context.baseBranch || 'main',
        teamId: context.teamId,
        sessionId: context.sessionId
      };

      // Perform the review
      const reviewResult = await this.codeReviewService.reviewChanges(
        changes,
        reviewContext
      );

      res.json({
        success: true,
        data: reviewResult
      });

    } catch (error) {
      logger.error('Failed to review file', error);
      res.status(500).json({
        success: false,
        message: 'Failed to review file',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Get review statistics
   * GET /api/llm/code-review/stats
   */
  public getReviewStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const { teamId, timeRange = '7d' } = req.query;

      // This would typically query a database for statistics
      // For now, return mock statistics
      const stats = {
        totalReviews: 0,
        averageScore: 0,
        issuesByCategory: {},
        reviewsByAuthor: {},
        trendsOverTime: [],
        topIssues: []
      };

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Failed to get review stats', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve review statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const languageMap: { [key: string]: string } = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'kt': 'kotlin',
      'swift': 'swift',
      'scala': 'scala',
      'clj': 'clojure',
      'hs': 'haskell',
      'ml': 'ocaml',
      'fs': 'fsharp',
      'elm': 'elm',
      'dart': 'dart',
      'lua': 'lua',
      'r': 'r',
      'jl': 'julia',
      'nim': 'nim',
      'cr': 'crystal',
      'ex': 'elixir',
      'erl': 'erlang'
    };

    return languageMap[ext || ''] || 'unknown';
  }
}