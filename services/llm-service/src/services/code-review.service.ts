import { LlmService } from './llm.service';
import { TeamContextService } from './team-context.service';
import { PromptTemplateService } from './prompt-template.service';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('code-review-service');

export interface CodeChange {
  file: string;
  type: 'added' | 'modified' | 'deleted';
  diff: string;
  additions: number;
  deletions: number;
  language?: string;
}

export interface ReviewContext {
  pullRequestId?: string;
  commitId?: string;
  author: string;
  timestamp: Date;
  description?: string;
  branch: string;
  baseBranch: string;
  teamId?: string;
  sessionId?: string;
}

export interface ReviewIssue {
  id: string;
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  category: 'security' | 'performance' | 'maintainability' | 'style' | 'logic' | 'testing';
  file: string;
  line?: number;
  column?: number;
  title: string;
  description: string;
  suggestion?: string;
  confidence: number; // 0-1
  autoFixable: boolean;
  references?: string[];
}

export interface ReviewSummary {
  overallScore: number; // 0-100
  totalIssues: number;
  criticalIssues: number;
  majorIssues: number;
  minorIssues: number;
  suggestions: number;
  recommendation: 'approve' | 'request_changes' | 'comment';
  highlights: string[];
  risks: string[];
}

export interface CodeReviewResult {
  reviewId: string;
  context: ReviewContext;
  summary: ReviewSummary;
  issues: ReviewIssue[];
  metadata: {
    reviewedAt: Date;
    processingTime: number;
    linesOfCode: number;
    filesReviewed: number;
    model: string;
  };
}

export class CodeReviewService {
  constructor(
    private llmService: LlmService,
    private teamContextService: TeamContextService,
    private promptTemplateService: PromptTemplateService
  ) {}

  /**
   * Perform automated code review on changes
   */
  async reviewChanges(
    changes: CodeChange[],
    context: ReviewContext
  ): Promise<CodeReviewResult> {
    const startTime = Date.now();
    const reviewId = this.generateReviewId();
    
    logger.info(`Starting code review ${reviewId} for ${changes.length} files`);

    try {
      // Get team context if available
      const teamContext = context.teamId && context.sessionId 
        ? await this.teamContextService.getTeamContext(context.teamId, context.sessionId)
        : null;

      // Analyze each file change
      const fileAnalyses = await Promise.all(
        changes.map(change => this.analyzeFileChange(change, context, teamContext))
      );

      // Combine all issues
      const allIssues = fileAnalyses.flatMap(analysis => analysis.issues);

      // Generate overall summary
      const summary = await this.generateReviewSummary(changes, allIssues, context, teamContext);

      // Calculate metadata
      const processingTime = Date.now() - startTime;
      const linesOfCode = changes.reduce((total, change) => total + change.additions + change.deletions, 0);

      const result: CodeReviewResult = {
        reviewId,
        context,
        summary,
        issues: allIssues,
        metadata: {
          reviewedAt: new Date(),
          processingTime,
          linesOfCode,
          filesReviewed: changes.length,
          model: this.llmService.getActiveConfig()?.model || 'unknown'
        }
      };

      logger.info(`Completed code review ${reviewId} in ${processingTime}ms`);
      return result;

    } catch (error) {
      logger.error(`Failed to complete code review ${reviewId}`, error);
      throw error;
    }
  }

  /**
   * Analyze a single file change
   */
  private async analyzeFileChange(
    change: CodeChange,
    context: ReviewContext,
    teamContext: any
  ): Promise<{ issues: ReviewIssue[] }> {
    try {
      // Skip deleted files
      if (change.type === 'deleted') {
        return { issues: [] };
      }

      // Build analysis prompt
      const prompt = await this.buildFileAnalysisPrompt(change, context, teamContext);

      // Get LLM analysis
      const response = await this.llmService.createCompletion({
        messages: [
          {
            role: 'system',
            content: `You are an expert code reviewer. Analyze the provided code changes and identify issues with specific focus on security, performance, maintainability, and best practices.

Return your analysis as a JSON object with the following structure:
{
  "issues": [
    {
      "severity": "critical|major|minor|suggestion",
      "category": "security|performance|maintainability|style|logic|testing",
      "line": number,
      "column": number,
      "title": "Brief issue title", 
      "description": "Detailed description of the issue",
      "suggestion": "How to fix this issue",
      "confidence": 0.95,
      "autoFixable": true|false,
      "references": ["relevant documentation or standards"]
    }
  ]
}`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        options: {
          temperature: 0.1, // Low temperature for consistent analysis
          maxTokens: 4000
        }
      });

      // Parse the response
      const analysisResult = this.parseAnalysisResponse(response.content, change.file);
      return analysisResult;

    } catch (error) {
      logger.error(`Failed to analyze file ${change.file}`, error);
      return { issues: [] };
    }
  }

  /**
   * Build analysis prompt for a file change
   */
  private async buildFileAnalysisPrompt(
    change: CodeChange,
    context: ReviewContext,
    teamContext: any
  ): Promise<string> {
    let prompt = `File: ${change.file}\n`;
    prompt += `Change Type: ${change.type}\n`;
    prompt += `Language: ${change.language || 'unknown'}\n`;
    prompt += `Author: ${context.author}\n`;
    prompt += `Branch: ${context.branch} -> ${context.baseBranch}\n\n`;

    if (context.description) {
      prompt += `Change Description: ${context.description}\n\n`;
    }

    // Add team context if available
    if (teamContext) {
      prompt += `Team Context:\n`;
      if (teamContext.teamPatterns?.codeStyles) {
        prompt += `- Code Style Preferences: ${JSON.stringify(teamContext.teamPatterns.codeStyles)}\n`;
      }
      if (teamContext.teamPatterns?.commonLibraries) {
        prompt += `- Common Libraries: ${teamContext.teamPatterns.commonLibraries.join(', ')}\n`;
      }
      prompt += `\n`;
    }

    prompt += `Code Changes:\n\`\`\`diff\n${change.diff}\n\`\`\`\n\n`;

    prompt += `Please analyze this code change and identify any issues, focusing on:
1. Security vulnerabilities and potential exploits
2. Performance issues and optimization opportunities  
3. Code maintainability and readability
4. Adherence to best practices and standards
5. Logic errors or potential bugs
6. Testing considerations
7. Team coding standards compliance (if team context provided)

For each issue found, provide specific line numbers, clear explanations, and actionable suggestions for improvement.`;

    return prompt;
  }

  /**
   * Generate overall review summary
   */
  private async generateReviewSummary(
    changes: CodeChange[],
    issues: ReviewIssue[],
    context: ReviewContext,
    teamContext: any
  ): Promise<ReviewSummary> {
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const majorIssues = issues.filter(i => i.severity === 'major').length;
    const minorIssues = issues.filter(i => i.severity === 'minor').length;
    const suggestions = issues.filter(i => i.severity === 'suggestion').length;

    // Calculate overall score (0-100)
    let score = 100;
    score -= criticalIssues * 25; // Critical issues heavily impact score
    score -= majorIssues * 10;
    score -= minorIssues * 3;
    score -= suggestions * 1;
    score = Math.max(0, score);

    // Determine recommendation
    let recommendation: 'approve' | 'request_changes' | 'comment';
    if (criticalIssues > 0 || majorIssues > 3) {
      recommendation = 'request_changes';
    } else if (majorIssues > 0 || minorIssues > 5) {
      recommendation = 'comment';
    } else {
      recommendation = 'approve';
    }

    // Generate summary using LLM
    const summaryPrompt = this.buildSummaryPrompt(changes, issues, context, score, recommendation);
    
    try {
      const response = await this.llmService.createCompletion({
        messages: [
          {
            role: 'system',
            content: `You are an expert code reviewer providing a summary of code review findings. 
Generate highlights and risks based on the analysis results.
Return JSON with: { "highlights": ["..."], "risks": ["..."] }`
          },
          {
            role: 'user',
            content: summaryPrompt
          }
        ],
        options: {
          temperature: 0.2,
          maxTokens: 1000
        }
      });

      const summaryData = this.parseSummaryResponse(response.content);

      return {
        overallScore: score,
        totalIssues: issues.length,
        criticalIssues,
        majorIssues,
        minorIssues,
        suggestions,
        recommendation,
        highlights: summaryData.highlights || [],
        risks: summaryData.risks || []
      };

    } catch (error) {
      logger.error('Failed to generate summary', error);
      
      // Fallback summary
      return {
        overallScore: score,
        totalIssues: issues.length,
        criticalIssues,
        majorIssues,
        minorIssues,
        suggestions,
        recommendation,
        highlights: ['Automated code review completed'],
        risks: criticalIssues > 0 ? ['Critical security or logic issues found'] : []
      };
    }
  }

  /**
   * Build summary prompt
   */
  private buildSummaryPrompt(
    changes: CodeChange[],
    issues: ReviewIssue[],
    context: ReviewContext,
    score: number,
    recommendation: string
  ): string {
    let prompt = `Code Review Summary for ${context.author}'s changes:\n\n`;
    prompt += `Files Changed: ${changes.length}\n`;
    prompt += `Total Issues Found: ${issues.length}\n`;
    prompt += `Overall Score: ${score}/100\n`;
    prompt += `Recommendation: ${recommendation}\n\n`;

    if (issues.length > 0) {
      prompt += `Issues by Category:\n`;
      const categories = [...new Set(issues.map(i => i.category))];
      categories.forEach(category => {
        const categoryIssues = issues.filter(i => i.category === category);
        prompt += `- ${category}: ${categoryIssues.length} issues\n`;
      });
      prompt += `\n`;

      prompt += `Top Issues:\n`;
      const topIssues = issues
        .sort((a, b) => {
          const severityOrder = { critical: 4, major: 3, minor: 2, suggestion: 1 };
          return severityOrder[b.severity] - severityOrder[a.severity];
        })
        .slice(0, 5);
      
      topIssues.forEach((issue, index) => {
        prompt += `${index + 1}. [${issue.severity.toUpperCase()}] ${issue.title} (${issue.file})\n`;
      });
    }

    prompt += `\nPlease provide key highlights of good practices found and main risks that need attention.`;

    return prompt;
  }

  /**
   * Parse analysis response from LLM
   */
  private parseAnalysisResponse(content: string, filename: string): { issues: ReviewIssue[] } {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn(`No JSON found in analysis response for ${filename}`);
        return { issues: [] };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!parsed.issues || !Array.isArray(parsed.issues)) {
        logger.warn(`Invalid issues array in response for ${filename}`);
        return { issues: [] };
      }

      // Validate and normalize issues
      const issues: ReviewIssue[] = parsed.issues
        .filter((issue: any) => issue.title && issue.description)
        .map((issue: any, index: number) => ({
          id: `${filename}-${index}`,
          severity: issue.severity || 'minor',
          category: issue.category || 'maintainability',
          file: filename,
          line: issue.line,
          column: issue.column,
          title: issue.title,
          description: issue.description,
          suggestion: issue.suggestion,
          confidence: Math.min(1, Math.max(0, issue.confidence || 0.5)),
          autoFixable: Boolean(issue.autoFixable),
          references: Array.isArray(issue.references) ? issue.references : []
        }));

      return { issues };

    } catch (error) {
      logger.error(`Failed to parse analysis response for ${filename}`, error);
      return { issues: [] };
    }
  }

  /**
   * Parse summary response from LLM
   */
  private parseSummaryResponse(content: string): { highlights: string[]; risks: string[] } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { highlights: [], risks: [] };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks : []
      };

    } catch (error) {
      logger.error('Failed to parse summary response', error);
      return { highlights: [], risks: [] };
    }
  }

  /**
   * Generate unique review ID
   */
  private generateReviewId(): string {
    return `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get review by ID
   */
  async getReview(reviewId: string): Promise<CodeReviewResult | null> {
    // This would typically fetch from a database
    // For now, return null as this is just the service implementation
    return null;
  }

  /**
   * Auto-fix issues where possible
   */
  async autoFixIssues(reviewId: string, issueIds: string[]): Promise<{
    fixed: string[];
    failed: string[];
    changes: { file: string; diff: string }[];
  }> {
    // This would implement automatic fixing of simple issues
    // such as formatting, import organization, etc.
    return {
      fixed: [],
      failed: issueIds,
      changes: []
    };
  }
}