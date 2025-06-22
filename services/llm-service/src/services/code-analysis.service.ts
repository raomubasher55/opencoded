import { LlmService } from './llm.service';
import { PromptTemplateService } from './prompt-template.service';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Service for code analysis and AI-enhanced capabilities
 */
export class CodeAnalysisService {
  constructor(
    private llmService: LlmService,
    private promptTemplateService: PromptTemplateService
  ) {}

  /**
   * Analyze code for documentation
   * @param code The code to analyze
   * @param language The programming language
   */
  async generateDocumentation(code: string, language: string): Promise<string> {
    const template = await this.promptTemplateService.getTemplate('code-documentation');
    
    if (!template) {
      throw new Error('Template not found: code-documentation');
    }
    
    const prompt = template.render({
      code,
      language
    });
    
    // Create a simple message without session information
    const simpleMessage = {
      role: 'user' as const,
      content: prompt
    };
    
    // Call LLM service with the simple message
    const completion = await this.llmService.createCompletion({
      messages: [simpleMessage] as any, // Type cast to avoid session ID requirement
      options: { maxTokens: 1000 }
    });
    
    return completion.content;
  }
  
  /**
   * Generate tests for the provided code
   * @param code The code to generate tests for
   * @param language The programming language
   * @param testFramework The test framework to use (e.g., 'jest', 'pytest')
   */
  async generateTests(code: string, language: string, testFramework?: string): Promise<string> {
    const template = await this.promptTemplateService.getTemplate('test-generation');
    
    if (!template) {
      throw new Error('Template not found: test-generation');
    }
    
    // Prepare variables object with optional testFramework
    const variables: any = {
      code,
      language
    };
    
    if (testFramework) {
      variables.testFramework = testFramework;
    }
    
    const prompt = template.render(variables);
    
    // Create a simple message without session information
    const simpleMessage = {
      role: 'user' as const,
      content: prompt
    };
    
    // Call LLM service with the simple message
    const completion = await this.llmService.createCompletion({
      messages: [simpleMessage] as any, // Type cast to avoid session ID requirement
      options: { maxTokens: 2000 }
    });
    
    return completion.content;
  }
  
  /**
   * Analyze code for security issues
   * @param code The code to analyze
   * @param language The programming language
   */
  async analyzeSecurity(code: string, language: string): Promise<{
    issues: Array<{
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      lineNumber?: number;
      suggestion?: string;
    }>;
    summary: string;
  }> {
    const template = await this.promptTemplateService.getTemplate('security-analysis');
    
    if (!template) {
      throw new Error('Template not found: security-analysis');
    }
    
    const prompt = template.render({
      code,
      language
    });
    
    // Create a simple message without session information
    const simpleMessage = {
      role: 'user' as const,
      content: prompt
    };
    
    // Call LLM service with the simple message
    const completion = await this.llmService.createCompletion({
      messages: [simpleMessage] as any, // Type cast to avoid session ID requirement
      options: { 
        maxTokens: 2000
        // Note: responseFormat is not supported in the interface, will rely on prompt
      }
    });
    
    try {
      return JSON.parse(completion.content);
    } catch (error) {
      // If parsing fails, return a default structure
      return {
        issues: [{
          severity: 'low',
          description: 'Could not parse security analysis results',
          suggestion: 'Please try again with a smaller code sample'
        }],
        summary: 'Security analysis failed to parse results'
      };
    }
  }
  
  /**
   * Provide code improvement suggestions
   * @param code The code to analyze
   * @param language The programming language
   * @param focus The focus areas for improvement (e.g., 'performance', 'readability')
   */
  async suggestImprovements(
    code: string, 
    language: string,
    focus: string[] = ['readability', 'performance', 'maintainability']
  ): Promise<{
    suggestions: Array<{
      category: string;
      description: string;
      lineNumber?: number;
      suggestedCode?: string;
    }>;
    summary: string;
  }> {
    const template = await this.promptTemplateService.getTemplate('code-improvement');
    
    if (!template) {
      throw new Error('Template not found: code-improvement');
    }
    
    const prompt = template.render({
      code,
      language,
      focus: focus.join(', ')
    });
    
    // Create a simple message without session information
    const simpleMessage = {
      role: 'user' as const,
      content: prompt
    };
    
    // Call LLM service with the simple message
    const completion = await this.llmService.createCompletion({
      messages: [simpleMessage] as any, // Type cast to avoid session ID requirement
      options: { 
        maxTokens: 2000
        // Note: responseFormat is not supported in the interface, will rely on prompt
      }
    });
    
    try {
      return JSON.parse(completion.content);
    } catch (error) {
      // If parsing fails, return a default structure
      return {
        suggestions: [{
          category: 'general',
          description: 'Could not parse improvement suggestions',
        }],
        summary: 'Code improvement analysis failed to parse results'
      };
    }
  }
  
  /**
   * Refactor code according to given objectives
   * @param code The code to refactor
   * @param language The programming language
   * @param objectives The refactoring objectives
   */
  async refactorCode(
    code: string,
    language: string,
    objectives: string[]
  ): Promise<{
    refactoredCode: string;
    explanation: string;
    changes: Array<{
      description: string;
      before?: string;
      after?: string;
    }>;
  }> {
    const template = await this.promptTemplateService.getTemplate('code-refactoring');
    
    if (!template) {
      throw new Error('Template not found: code-refactoring');
    }
    
    const prompt = template.render({
      code,
      language,
      objectives: objectives.join(', ')
    });
    
    // Create a simple message without session information
    const simpleMessage = {
      role: 'user' as const,
      content: prompt
    };
    
    // Call LLM service with the simple message
    const completion = await this.llmService.createCompletion({
      messages: [simpleMessage] as any, // Type cast to avoid session ID requirement
      options: { 
        maxTokens: 3000
        // Note: responseFormat is not supported in the interface, will rely on prompt
      }
    });
    
    try {
      return JSON.parse(completion.content);
    } catch (error) {
      // If parsing fails, return a basic response
      return {
        refactoredCode: code,
        explanation: 'Failed to refactor code. The model response could not be parsed.',
        changes: []
      };
    }
  }
  
  /**
   * Explain code in detail
   * @param code The code to explain
   * @param language The programming language
   */
  async explainCode(code: string, language: string): Promise<{
    explanation: string;
    lineByLine?: Array<{
      line: number;
      code: string;
      explanation: string;
    }>;
  }> {
    const template = await this.promptTemplateService.getTemplate('code-explanation');
    
    if (!template) {
      throw new Error('Template not found: code-explanation');
    }
    
    const prompt = template.render({
      code,
      language
    });
    
    // Create a simple message without session information
    const simpleMessage = {
      role: 'user' as const,
      content: prompt
    };
    
    // Call LLM service with the simple message
    const completion = await this.llmService.createCompletion({
      messages: [simpleMessage] as any, // Type cast to avoid session ID requirement
      options: { 
        maxTokens: 2500
        // Note: responseFormat is not supported in the interface, will rely on prompt
      }
    });
    
    try {
      return JSON.parse(completion.content);
    } catch (error) {
      // If parsing fails, return a basic explanation
      return {
        explanation: completion.content || 'Failed to generate code explanation'
      };
    }
  }
  
  /**
   * Analyze project structure and provide recommendations
   * @param projectFiles List of files in the project
   * @param selectedFiles Contents of selected key files
   */
  async analyzeProjectStructure(
    projectFiles: string[],
    selectedFiles: Record<string, string>
  ): Promise<{
    structure: {
      strengths: string[];
      weaknesses: string[];
      recommendations: string[];
    };
    dependencies: {
      unnecessary?: string[];
      outdated?: string[];
      recommended?: string[];
    };
    architecture: {
      pattern?: string;
      issues?: string[];
      suggestions?: string[];
    };
  }> {
    const template = await this.promptTemplateService.getTemplate('project-analysis');
    
    if (!template) {
      throw new Error('Template not found: project-analysis');
    }
    
    const prompt = template.render({
      projectFiles: projectFiles.join('\n'),
      selectedFiles: Object.entries(selectedFiles)
        .map(([file, content]) => `### ${file}\n\`\`\`\n${content}\n\`\`\``)
        .join('\n\n')
    });
    
    // Create a simple message without session information
    const simpleMessage = {
      role: 'user' as const,
      content: prompt
    };
    
    // Call LLM service with the simple message
    const completion = await this.llmService.createCompletion({
      messages: [simpleMessage] as any, // Type cast to avoid session ID requirement
      options: { 
        maxTokens: 3000
        // Note: responseFormat is not supported in the interface, will rely on prompt
      }
    });
    
    try {
      return JSON.parse(completion.content);
    } catch (error) {
      // If parsing fails, return a basic structure
      return {
        structure: {
          strengths: ['Could not analyze project structure'],
          weaknesses: [],
          recommendations: ['Try analyzing with fewer files']
        },
        dependencies: {},
        architecture: {}
      };
    }
  }
  
  /**
   * Generate code from natural language description
   * @param description The natural language description
   * @param language The target programming language
   * @param context Additional context (e.g., existing code)
   */
  async generateCode(
    description: string,
    language: string,
    context?: string
  ): Promise<{
    code: string;
    explanation: string;
  }> {
    const template = await this.promptTemplateService.getTemplate('code-generation');
    
    if (!template) {
      throw new Error('Template not found: code-generation');
    }
    
    const prompt = template.render({
      description,
      language,
      context: context || ''
    });
    
    // Create a simple message without session information
    const simpleMessage = {
      role: 'user' as const,
      content: prompt
    };
    
    // Call LLM service with the simple message
    const completion = await this.llmService.createCompletion({
      messages: [simpleMessage] as any, // Type cast to avoid session ID requirement
      options: { 
        maxTokens: 2500
        // Note: responseFormat is not supported in the interface, will rely on prompt
      }
    });
    
    try {
      return JSON.parse(completion.content);
    } catch (error) {
      // Extract code blocks if JSON parsing fails
      const codeBlockRegex = /\`\`\`(?:\w+)?\n([\s\S]*?)\n\`\`\`/g;
      const matches = [...completion.content.matchAll(codeBlockRegex)];
      
      if (matches.length > 0) {
        return {
          code: matches.map(m => m[1]).join('\n\n'),
          explanation: 'Generated code extracted from response'
        };
      }
      
      return {
        code: '',
        explanation: 'Failed to generate code from description'
      };
    }
  }
}