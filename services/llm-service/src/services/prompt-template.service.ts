import { createServiceLogger } from '@opencode/shared-utils';
import fs from 'fs/promises';
import path from 'path';

const logger = createServiceLogger('prompt-template-service');

/**
 * Interface for template variables
 */
export interface TemplateVariables {
  [key: string]: string | number | boolean | TemplateVariables | Array<any>;
}

/**
 * Prompt template class
 */
export class PromptTemplate {
  private template: string;
  private name: string;

  constructor(name: string, template: string) {
    this.name = name;
    this.template = template;
  }

  /**
   * Get the template name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Get the raw template string
   */
  getRawTemplate(): string {
    return this.template;
  }

  /**
   * Render the template with variables
   */
  render(variables: TemplateVariables = {}): string {
    let result = this.template;
    
    // Replace all variables in the template
    // Format: {{variableName}}
    const variableRegex = /\{\{([^}]+)\}\}/g;
    
    result = result.replace(variableRegex, (match, variablePath) => {
      const path = variablePath.trim().split('.');
      let value: any = variables;
      
      // Traverse the path
      for (const key of path) {
        if (value === undefined || value === null) {
          return match; // Keep original placeholder if path is invalid
        }
        value = value[key];
      }
      
      if (value === undefined || value === null) {
        return match; // Keep original placeholder if value is null/undefined
      }
      
      if (typeof value === 'object') {
        return JSON.stringify(value); // Stringify objects and arrays
      }
      
      return String(value);
    });
    
    return result;
  }
}

/**
 * Prompt template service for managing and rendering templates
 */
export class PromptTemplateService {
  private templates: Map<string, PromptTemplate> = new Map();
  private templatesDir: string;
  
  constructor(templatesDir?: string) {
    this.templatesDir = templatesDir || path.join(process.cwd(), 'templates');
  }
  
  /**
   * Load a template from a file
   */
  async loadFromFile(filePath: string): Promise<PromptTemplate> {
    try {
      const templateContent = await fs.readFile(filePath, 'utf-8');
      const templateName = path.basename(filePath, path.extname(filePath));
      
      const template = new PromptTemplate(templateName, templateContent);
      this.templates.set(templateName, template);
      
      logger.debug(`Loaded template: ${templateName}`);
      return template;
    } catch (error) {
      logger.error(`Error loading template from file: ${filePath}`, error);
      throw error;
    }
  }
  
  /**
   * Load all templates from the templates directory
   */
  async loadAllTemplates(): Promise<Map<string, PromptTemplate>> {
    try {
      // Check if templates directory exists, create if it doesn't
      try {
        await fs.access(this.templatesDir);
      } catch (error) {
        await fs.mkdir(this.templatesDir, { recursive: true });
        logger.info(`Created templates directory: ${this.templatesDir}`);
      }
      
      const files = await fs.readdir(this.templatesDir);
      const templateFiles = files.filter(file => file.endsWith('.txt') || file.endsWith('.md'));
      
      for (const file of templateFiles) {
        const filePath = path.join(this.templatesDir, file);
        await this.loadFromFile(filePath);
      }
      
      logger.info(`Loaded ${this.templates.size} templates from ${this.templatesDir}`);
      return this.templates;
    } catch (error) {
      logger.error('Error loading templates', error);
      throw error;
    }
  }
  
  /**
   * Get a template by name
   */
  getTemplate(name: string): PromptTemplate | undefined {
    return this.templates.get(name);
  }
  
  /**
   * Get all template names
   */
  getTemplateNames(): string[] {
    return Array.from(this.templates.keys());
  }
  
  /**
   * Add or update a template
   */
  addTemplate(name: string, content: string): PromptTemplate {
    const template = new PromptTemplate(name, content);
    this.templates.set(name, template);
    return template;
  }
  
  /**
   * Remove a template
   */
  removeTemplate(name: string): boolean {
    return this.templates.delete(name);
  }
  
  /**
   * Save a template to the templates directory
   */
  async saveTemplate(name: string, content: string): Promise<PromptTemplate> {
    try {
      // Create template
      const template = this.addTemplate(name, content);
      
      // Ensure templates directory exists
      try {
        await fs.access(this.templatesDir);
      } catch (error) {
        await fs.mkdir(this.templatesDir, { recursive: true });
      }
      
      // Save to file
      const filePath = path.join(this.templatesDir, `${name}.txt`);
      await fs.writeFile(filePath, content);
      
      logger.info(`Saved template: ${name}`);
      return template;
    } catch (error) {
      logger.error(`Error saving template: ${name}`, error);
      throw error;
    }
  }
  
  /**
   * Render a template with variables
   */
  renderTemplate(name: string, variables: TemplateVariables = {}): string {
    const template = this.getTemplate(name);
    
    if (!template) {
      throw new Error(`Template not found: ${name}`);
    }
    
    return template.render(variables);
  }
}