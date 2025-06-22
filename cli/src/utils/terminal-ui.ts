import { terminal as term } from 'terminal-kit';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import { SyntaxHighlighter } from './syntax-highlighter';
import { OpenCodedConfig } from '../types/config';

/**
 * Options for the terminal UI
 */
export interface TerminalUIOptions {
  showLineNumbers?: boolean;
  maxWidth?: number;
  theme?: 'light' | 'dark' | 'system';
}

/**
 * Enhanced terminal UI components for OpenCoded CLI
 */
export class TerminalUI {
  private options: TerminalUIOptions;
  private spinner: Ora | null = null;
  private progressBar: any = null;
  private currentMessageChunk: string = '';
  
  constructor(options: TerminalUIOptions = {}) {
    this.options = {
      showLineNumbers: true,
      maxWidth: process.stdout.columns || 80,
      theme: 'dark',
      ...options
    };
  }

  /**
   * Clear the terminal screen
   */
  clearScreen(): void {
    term.clear();
  }

  /**
   * Display a header with title and optional subtitle
   */
  displayHeader(title: string, subtitle?: string): void {
    term.bold.blue(`\n${title}\n`);
    
    if (subtitle) {
      term.gray(`${subtitle}\n`);
    }
    
    this.drawDivider();
  }

  /**
   * Draw a horizontal divider
   */
  drawDivider(character = '─'): void {
    const width = Math.min(this.options.maxWidth || 80, process.stdout.columns || 80);
    term.gray(character.repeat(width) + '\n');
  }

  /**
   * Display code with syntax highlighting
   */
  displayCode(code: string, language: string, options: { 
    title?: string;
    showLineNumbers?: boolean;
    startLine?: number;
    highlight?: number[];
  } = {}): void {
    // Apply syntax highlighting
    const highlightedCode = SyntaxHighlighter.highlight(code, language);
    const lines = highlightedCode.split('\n');
    
    // Display code title if provided
    if (options.title) {
      term.yellow(`\n${options.title}\n`);
    }
    
    // Display each line of code
    const showLineNumbers = options.showLineNumbers ?? this.options.showLineNumbers;
    const startLine = options.startLine || 1;
    const highlightLines = options.highlight || [];
    
    term('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const lineNumber = startLine + i;
      const isHighlighted = highlightLines.includes(lineNumber);
      
      // Highlight background if line is highlighted
      if (isHighlighted) {
        term.bgGray.white(' '.repeat(process.stdout.columns || 80));
        term.column(0);
      }
      
      // Display line number if enabled
      if (showLineNumbers) {
        const lineNumberStr = ` ${lineNumber.toString().padStart(3, ' ')} | `;
        term.gray(lineNumberStr);
      }
      
      // Display the line content
      term(lines[i] + '\n');
    }
    
    term('\n');
  }

  /**
   * Display a file with syntax highlighting
   */
  displayFile(filePath: string, content: string, options: {
    showLineNumbers?: boolean;
    startLine?: number;
    highlight?: number[];
  } = {}): void {
    this.displayCode(
      content, 
      SyntaxHighlighter.detectLanguage(filePath), 
      { 
        title: filePath,
        ...options
      }
    );
  }

  /**
   * Create and display a progress bar
   */
  createProgressBar(options: {
    title?: string;
    total: number;
    width?: number;
  }): { update: (value: number) => void; complete: () => void } {
    const title = options.title || 'Progress';
    const width = options.width || 50;
    
    term(title + ' ');
    
    const progressBar = term.progressBar({
      width,
      title: '',
      eta: true,
      percent: true
    });
    
    return {
      update: (value: number) => {
        progressBar.update(value / options.total);
      },
      complete: () => {
        progressBar.update(1);
        term('\n');
      }
    };
  }

  /**
   * Start a spinner with a message
   */
  startSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.stop();
    }
    
    this.spinner = ora({
      text: message,
      spinner: 'dots'
    }).start();
  }

  /**
   * Update the spinner message
   */
  updateSpinner(message: string): void {
    if (this.spinner) {
      this.spinner.text = message;
    }
  }

  /**
   * Stop the spinner with a success message
   */
  stopSpinnerSuccess(message?: string): void {
    if (this.spinner) {
      if (message) {
        this.spinner.succeed(message);
      } else {
        this.spinner.succeed();
      }
      this.spinner = null;
    }
  }

  /**
   * Stop the spinner with a failure message
   */
  stopSpinnerFail(message?: string): void {
    if (this.spinner) {
      if (message) {
        this.spinner.fail(message);
      } else {
        this.spinner.fail();
      }
      this.spinner = null;
    }
  }

  /**
   * Display a user message
   */
  displayUserMessage(message: string): void {
    term.bold.green('\nYou: ');
    term(message + '\n');
  }

  /**
   * Display an AI assistant message
   */
  displayAssistantMessage(message: string): void {
    term.bold.blue('\nAI Assistant: \n');
    term(message + '\n');
  }

  /**
   * Display a system message
   */
  displaySystemMessage(message: string): void {
    term.gray(`\n${message}\n`);
  }

  /**
   * Create an interactive menu
   */
  async displayMenu(title: string, items: string[]): Promise<number> {
    term.bold(`\n${title}\n`);
    
    const response = await term.singleColumnMenu(items).promise;
    return response.selectedIndex;
  }

  /**
   * Get user input with a prompt
   */
  async getUserInput(prompt: string): Promise<string> {
    term.bold(prompt + ' ');
    return await term.inputField().promise;
  }
  
  /**
   * Display a multi-line input area for the user
   */
  async getMultiLineInput(prompt: string): Promise<string> {
    term.bold(prompt + '\n');
    term.gray('(Type "END" on a new line to finish)\n');
    
    let text = '';
    let line = '';
    let finished = false;
    
    while (!finished) {
      line = await term.inputField().promise;
      term('\n');
      
      if (line === 'END') {
        finished = true;
      } else {
        text += line + '\n';
      }
    }
    
    return text;
  }

  /**
   * Apply theme based on configuration
   */
  applyTheme(config: OpenCodedConfig): void {
    const theme = config.ui?.theme || 'system';
    
    // If theme is system, detect based on terminal background
    if (theme === 'system') {
      // This is a simplistic approach - terminal-kit might have better ways
      // to detect the terminal's color scheme
      try {
        // We'll use terminal-kit's background detection if available
        const isDarkTheme = term.colorDepth > 1;
        this.options.theme = isDarkTheme ? 'dark' : 'light';
      } catch (error) {
        // Default to dark if detection fails
        this.options.theme = 'dark';
      }
    } else {
      this.options.theme = theme;
    }
  }

  /**
   * Check if spinner is active
   */
  isSpinnerActive(): boolean {
    return this.spinner !== null;
  }

  /**
   * Display a streaming message chunk
   */
  displayMessageChunk(chunk: string, done: boolean): void {
    // Add chunk to current message
    this.currentMessageChunk += chunk;
    
    // If it's the first chunk, start with assistant prefix
    if (this.currentMessageChunk.length === chunk.length) {
      term('\n');
      term.bold.blue('AI Assistant: ');
    }
    
    // Display the chunk
    term(chunk);
    
    // If done, add newline and reset
    if (done) {
      term('\n');
      this.currentMessageChunk = '';
    }
  }

  /**
   * Update a progress bar
   */
  updateProgressBar(percent: number, message?: string): void {
    if (!this.progressBar) {
      // Create a new progress bar if it doesn't exist
      this.progressBar = term.progressBar({
        width: 80,
        title: message || 'Progress:',
        percent: true
      });
    }
    
    // Update the progress bar
    this.progressBar.update(percent / 100);
    
    // Update the title if provided
    if (message) {
      this.progressBar.update({ title: message });
    }
    
    // If complete, destroy the progress bar
    if (percent >= 100) {
      this.progressBar = null;
    }
  }

  /**
   * Display an error message
   */
  displayErrorMessage(message: string): void {
    term('\n');
    term.bold.red('Error: ');
    term(message);
    term('\n');
  }
  
  /**
   * Display a confirmation prompt and get response
   */
  async confirm(question: string): Promise<boolean> {
    term('\n');
    term.bold(question + ' (y/n) ');
    
    const response = await new Promise<string>(resolve => {
      term.inputField({ default: 'y' }, (error: any, input: string) => {
        term('\n');
        resolve(input || 'y');
      });
    });
    
    return response.toLowerCase().startsWith('y');
  }

  /**
   * Create a table display
   */
  displayTable(headers: string[], rows: string[][]): void {
    // Calculate max width for each column
    const colWidths = headers.map((header, index) => {
      const maxRowWidth = rows.reduce((max, row) => 
        Math.max(max, (row[index] || '').length), 0);
      return Math.max(header.length, maxRowWidth) + 2; // Add padding
    });
    
    // Display headers
    term('\n');
    headers.forEach((header, index) => {
      term.bold(header.padEnd(colWidths[index]));
    });
    term('\n');
    
    // Display separator
    const separator = colWidths.map(width => '─'.repeat(width)).join('');
    term.gray(separator + '\n');
    
    // Display rows
    rows.forEach(row => {
      row.forEach((cell, index) => {
        term(cell.padEnd(colWidths[index]));
      });
      term('\n');
    });
    term('\n');
  }
}