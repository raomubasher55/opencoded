import chalk from 'chalk';
import path from 'path';

/**
 * Simple syntax highlighting for common code languages
 */
export class SyntaxHighlighter {
  private static readonly languageExtensions: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.rb': 'ruby',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust',
    '.c': 'c',
    '.cpp': 'cpp',
    '.h': 'c',
    '.hpp': 'cpp',
    '.cs': 'csharp',
    '.php': 'php',
    '.sh': 'bash',
    '.md': 'markdown',
    '.json': 'json',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.xml': 'xml',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sql': 'sql',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.dart': 'dart',
  };

  /**
   * Detect language from file extension
   */
  static detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    return this.languageExtensions[ext] || 'text';
  }

  /**
   * Highlight code based on language
   */
  static highlight(code: string, language: string): string {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return this.highlightJsTs(code);
      case 'python':
        return this.highlightPython(code);
      case 'json':
        return this.highlightJson(code);
      case 'markdown':
        return this.highlightMarkdown(code);
      case 'html':
      case 'xml':
        return this.highlightHtml(code);
      case 'css':
      case 'scss':
        return this.highlightCss(code);
      default:
        return this.highlightGeneric(code);
    }
  }

  /**
   * Highlight code from a file
   */
  static highlightFile(code: string, filePath: string): string {
    const language = this.detectLanguage(filePath);
    return this.highlight(code, language);
  }

  /**
   * Highlight JavaScript/TypeScript
   */
  private static highlightJsTs(code: string): string {
    // Keywords
    const keywords = [
      'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
      'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'false',
      'finally', 'for', 'from', 'function', 'if', 'import', 'in', 'instanceof',
      'interface', 'let', 'new', 'null', 'return', 'static', 'super', 'switch',
      'this', 'throw', 'true', 'try', 'typeof', 'var', 'void', 'while', 'with',
      'yield', 'enum', 'implements', 'package', 'protected', 'public', 'private',
      'readonly', 'as', 'any', 'boolean', 'number', 'string', 'symbol', 'type',
      'undefined', 'unknown'
    ];

    // RegExp patterns
    const patterns = [
      // Strings
      { pattern: /(['"`])(.*?)\1/g, replacement: (match: string) => chalk.yellow(match) },
      // Comments
      { pattern: /\/\/.*$/gm, replacement: (match: string) => chalk.gray(match) },
      { pattern: /\/\*[\s\S]*?\*\//g, replacement: (match: string) => chalk.gray(match) },
      // Numbers
      { pattern: /\b(\d+(\.\d+)?)\b/g, replacement: (match: string) => chalk.cyan(match) },
      // Keywords
      { 
        pattern: new RegExp(`\\b(${keywords.join('|')})\\b`, 'g'),
        replacement: (match: string) => chalk.magenta(match)
      },
      // Function declarations
      { 
        pattern: /function\s+(\w+)/g,
        replacement: (match: string, funcName: string) => 
          match.replace(funcName, chalk.blue(funcName))
      },
      { 
        pattern: /(\w+)\s*\(/g,
        replacement: (match: string, funcName: string) => 
          match.replace(funcName, chalk.blue(funcName))
      },
      // Types and interfaces
      { 
        pattern: /\b(interface|type|class)\s+(\w+)/g,
        replacement: (match: string, keyword: string, name: string) => 
          match.replace(name, chalk.green(name))
      },
      // Decorators
      { 
        pattern: /@\w+/g,
        replacement: (match: string) => chalk.blue(match)
      }
    ];

    return this.applyHighlightPatterns(code, patterns);
  }

  /**
   * Highlight Python
   */
  private static highlightPython(code: string): string {
    // Keywords
    const keywords = [
      'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
      'break', 'class', 'continue', 'def', 'del', 'elif', 'else', 'except',
      'finally', 'for', 'from', 'global', 'if', 'import', 'in', 'is', 'lambda',
      'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'try', 'while',
      'with', 'yield'
    ];

    // RegExp patterns
    const patterns = [
      // Strings
      { pattern: /(['"])(.*?)\1/g, replacement: (match: string) => chalk.yellow(match) },
      // Comments
      { pattern: /#.*$/gm, replacement: (match: string) => chalk.gray(match) },
      // Numbers
      { pattern: /\b(\d+(\.\d+)?)\b/g, replacement: (match: string) => chalk.cyan(match) },
      // Keywords
      { 
        pattern: new RegExp(`\\b(${keywords.join('|')})\\b`, 'g'),
        replacement: (match: string) => chalk.magenta(match)
      },
      // Function declarations
      { 
        pattern: /def\s+(\w+)/g,
        replacement: (match: string, funcName: string) => 
          match.replace(funcName, chalk.blue(funcName))
      },
      // Class declarations
      { 
        pattern: /class\s+(\w+)/g,
        replacement: (match: string, className: string) => 
          match.replace(className, chalk.green(className))
      },
      // Decorators
      { 
        pattern: /@\w+/g,
        replacement: (match: string) => chalk.blue(match)
      }
    ];

    return this.applyHighlightPatterns(code, patterns);
  }

  /**
   * Highlight JSON
   */
  private static highlightJson(code: string): string {
    const patterns = [
      // Strings (property names and values)
      { pattern: /(".*?"):/g, replacement: (match: string) => match.replace(/(".*?")/g, chalk.green('$1')) },
      { pattern: /:\s*(".*?")/g, replacement: (match: string) => match.replace(/(".*?")/g, chalk.yellow('$1')) },
      // Numbers
      { pattern: /:\s*(-?\d+(\.\d+)?)/g, replacement: (match: string) => match.replace(/(-?\d+(\.\d+)?)/g, chalk.cyan('$1')) },
      // Booleans and null
      { pattern: /:\s*(true|false|null)/g, replacement: (match: string) => match.replace(/(true|false|null)/g, chalk.magenta('$1')) },
      // Brackets and braces
      { pattern: /[{}\[\]]/g, replacement: (match: string) => chalk.white(match) }
    ];

    return this.applyHighlightPatterns(code, patterns);
  }

  /**
   * Highlight Markdown
   */
  private static highlightMarkdown(code: string): string {
    const patterns = [
      // Headers
      { pattern: /^(#{1,6})\s+(.*)$/gm, replacement: (match: string) => chalk.bold.blue(match) },
      // Bold
      { pattern: /\*\*(.+?)\*\*/g, replacement: (match: string) => chalk.bold(match) },
      // Italic
      { pattern: /\*(.+?)\*/g, replacement: (match: string) => chalk.italic(match) },
      // Links
      { pattern: /\[(.+?)\]\((.+?)\)/g, replacement: (match: string, text: string, url: string) => 
        chalk.blue(`[${text}]`) + chalk.cyan(`(${url})`)
      },
      // Code blocks
      { 
        pattern: /```([\s\S]*?)```/g,
        replacement: (match: string) => chalk.gray(match)
      },
      // Inline code
      { 
        pattern: /`(.+?)`/g,
        replacement: (match: string) => chalk.gray(match)
      },
      // Lists
      { pattern: /^(\s*)([-*+]|\d+\.)\s/gm, replacement: (match: string) => chalk.red(match) }
    ];

    return this.applyHighlightPatterns(code, patterns);
  }

  /**
   * Highlight HTML/XML
   */
  private static highlightHtml(code: string): string {
    const patterns = [
      // Tags
      { 
        pattern: /(<\/?[^>]+>)/g,
        replacement: (match: string) => chalk.cyan(match)
      },
      // Attributes
      { 
        pattern: /(\s+[a-zA-Z0-9_-]+)=("[^"]*"|'[^']*')/g,
        replacement: (match: string, attr: string, value: string) => 
          chalk.blue(attr) + '=' + chalk.yellow(value)
      },
      // DOCTYPE and comments
      { 
        pattern: /(<!DOCTYPE[^>]+>)|<!--[\s\S]*?-->/g,
        replacement: (match: string) => chalk.gray(match)
      }
    ];

    return this.applyHighlightPatterns(code, patterns);
  }

  /**
   * Highlight CSS/SCSS
   */
  private static highlightCss(code: string): string {
    const patterns = [
      // Selectors
      { 
        pattern: /([.#]?[\w-]+)(?=\s*\{)/g,
        replacement: (match: string) => chalk.blue(match)
      },
      // Properties
      { 
        pattern: /([\w-]+)(?=\s*:)/g,
        replacement: (match: string) => chalk.green(match)
      },
      // Values
      { 
        pattern: /:\s*([\w-#]+)/g,
        replacement: (match: string, value: string) => 
          match.replace(value, chalk.yellow(value))
      },
      // Units
      { 
        pattern: /(\d+)(px|em|rem|%|vh|vw|pt|ex)/g,
        replacement: (match: string, num: string, unit: string) => 
          chalk.cyan(num) + chalk.magenta(unit)
      },
      // Comments
      { 
        pattern: /\/\*[\s\S]*?\*\//g,
        replacement: (match: string) => chalk.gray(match)
      }
    ];

    return this.applyHighlightPatterns(code, patterns);
  }

  /**
   * Generic code highlighting
   */
  private static highlightGeneric(code: string): string {
    const patterns = [
      // Strings
      { pattern: /(['"`])(.*?)\1/g, replacement: (match: string) => chalk.yellow(match) },
      // Comments
      { pattern: /\/\/.*$/gm, replacement: (match: string) => chalk.gray(match) },
      { pattern: /\/\*[\s\S]*?\*\//g, replacement: (match: string) => chalk.gray(match) },
      { pattern: /#.*$/gm, replacement: (match: string) => chalk.gray(match) },
      // Numbers
      { pattern: /\b(\d+(\.\d+)?)\b/g, replacement: (match: string) => chalk.cyan(match) },
      // Keywords (generic)
      { 
        pattern: /\b(if|else|for|while|do|switch|case|default|function|class|var|let|const|return|break|continue|try|catch|finally|import|export|from|as|public|private|protected|interface|extends|implements|new|delete|this|super|yield|async|await|static|void)\b/g,
        replacement: (match: string) => chalk.magenta(match)
      },
      // Parentheses, brackets, and braces
      { pattern: /[(){}\[\]]/g, replacement: (match: string) => chalk.white(match) }
    ];

    return this.applyHighlightPatterns(code, patterns);
  }

  /**
   * Apply highlight patterns to code
   */
  private static applyHighlightPatterns(
    code: string, 
    patterns: Array<{ pattern: RegExp, replacement: (match: string, ...args: string[]) => string }>
  ): string {
    let result = code;
    
    for (const { pattern, replacement } of patterns) {
      result = result.replace(pattern, replacement);
    }
    
    return result;
  }
}