import { Request, Response } from 'express';
import * as acorn from 'acorn';
import { SandboxService } from '../services/sandbox.service';

// Initialize sandbox service for secure execution
const sandboxService = new SandboxService();

/**
 * AnalysisController handles code analysis functionality
 */
export class AnalysisController {
  /**
   * Parse JavaScript/TypeScript code into an AST
   */
  async parseAst(req: Request, res: Response): Promise<void> {
    try {
      const { code, options } = req.body;
      
      if (!code) {
        res.status(400).json({ success: false, message: 'Code is required' });
        return;
      }

      // Parse code using acorn with safe defaults
      const parseOptions = {
        ecmaVersion: 'latest',
        sourceType: 'module',
        locations: true,
        ...options
      };

      const ast = acorn.parse(code, parseOptions);
      
      res.status(200).json({ 
        success: true, 
        data: {
          ast,
          sourceLength: code.length,
          sourceLines: code.split('\n').length
        }
      });
    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: `AST parsing failed: ${error.message}`,
        error: {
          name: error.name,
          message: error.message,
          line: error.loc?.line,
          column: error.loc?.column
        }
      });
    }
  }

  /**
   * Analyze code for quality issues
   */
  async analyzeCodeQuality(req: Request, res: Response): Promise<void> {
    try {
      const { code, language = 'javascript' } = req.body;
      
      if (!code) {
        res.status(400).json({ success: false, message: 'Code is required' });
        return;
      }

      // Use VM2 to safely execute a code quality analysis script
      // In a production environment, this would use proper analysis libraries
      const result = await sandboxService.executeInVM2(`
        // Simple code quality analysis simulation
        function analyzeCode(code, language) {
          const lines = code.split('\\n');
          
          // Calculate metrics
          const metrics = {
            lineCount: lines.length,
            emptyLines: lines.filter(line => line.trim() === '').length,
            longLines: lines.filter(line => line.length > 80).length,
            comments: lines.filter(line => {
              if (language === 'javascript' || language === 'typescript') {
                return line.trim().startsWith('//') || line.trim().startsWith('/*');
              }
              return false;
            }).length
          };
          
          // Simple code smells detection
          const codeSmells = [];
          
          // Check for long functions (naive implementation)
          let braceCount = 0;
          let currentFunction = null;
          let functionStartLine = 0;
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Extremely simple function detection
            if ((line.includes('function') || line.includes('=>')) && !currentFunction) {
              currentFunction = line.trim();
              functionStartLine = i;
            }
            
            // Count braces (very naive, doesn't handle strings, etc.)
            braceCount += (line.match(/{/g) || []).length;
            braceCount -= (line.match(/}/g) || []).length;
            
            // Check if function ended
            if (braceCount === 0 && currentFunction) {
              if (i - functionStartLine > 30) {
                codeSmells.push({
                  type: 'longFunction',
                  message: 'Function is too long (> 30 lines)',
                  function: currentFunction,
                  startLine: functionStartLine + 1,
                  endLine: i + 1
                });
              }
              currentFunction = null;
            }
          }
          
          // Check for long lines
          lines.forEach((line, index) => {
            if (line.length > 100) {
              codeSmells.push({
                type: 'longLine',
                message: 'Line exceeds 100 characters',
                line: index + 1,
                content: line.substring(0, 50) + '...'
              });
            }
          });
          
          // Check for too many parameters (naive implementation)
          lines.forEach((line, index) => {
            if (line.includes('function') || line.includes('=>')) {
              const match = line.match(/\\(([^)]+)\\)/);
              if (match && match[1]) {
                const params = match[1].split(',');
                if (params.length > 4) {
                  codeSmells.push({
                    type: 'tooManyParameters',
                    message: 'Function has too many parameters (> 4)',
                    line: index + 1,
                    content: line.trim()
                  });
                }
              }
            }
          });
          
          return {
            metrics,
            codeSmells,
            suggestions: codeSmells.map(smell => ({
              issue: smell.message,
              location: smell.line ? \`Line \${smell.line}\` : \`Lines \${smell.startLine}-\${smell.endLine}\`,
              suggestion: smell.type === 'longFunction' 
                ? 'Consider breaking this function into smaller, more focused functions'
                : smell.type === 'longLine'
                ? 'Consider breaking this line for better readability'
                : smell.type === 'tooManyParameters'
                ? 'Consider using an options object instead of many parameters'
                : 'Review this code'
            }))
          };
        }
        
        analyzeCode(${JSON.stringify(code)}, ${JSON.stringify(language)});
      `, {
        maxExecutionTimeMs: 5000,
        maxMemoryMB: 100,
        networkAccess: false,
        fileSystemAccess: []
      });
      
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Analyze dependencies in the code
   */
  async analyzeDependencies(req: Request, res: Response): Promise<void> {
    try {
      const { code, language = 'javascript' } = req.body;
      
      if (!code) {
        res.status(400).json({ success: false, message: 'Code is required' });
        return;
      }

      // Use VM2 to safely execute a dependency analysis script
      const result = await sandboxService.executeInVM2(`
        // Simple dependency analysis
        function analyzeDependencies(code, language) {
          const dependencies = [];
          const lines = code.split('\\n');
          
          if (language === 'javascript' || language === 'typescript') {
            // Look for imports and requires
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              
              // ES6 import
              if (line.startsWith('import ')) {
                const match = line.match(/from ['"]([^'"]+)['"]/);
                if (match && match[1]) {
                  dependencies.push({
                    name: match[1],
                    type: 'import',
                    line: i + 1
                  });
                }
              }
              
              // CommonJS require
              if (line.includes('require(')) {
                const match = line.match(/require\\(['"]([^'"]+)['"]/);
                if (match && match[1]) {
                  dependencies.push({
                    name: match[1],
                    type: 'require',
                    line: i + 1
                  });
                }
              }
            }
          } else if (language === 'python') {
            // Look for Python imports
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i].trim();
              
              if (line.startsWith('import ') || line.startsWith('from ')) {
                dependencies.push({
                  name: line,
                  type: 'import',
                  line: i + 1
                });
              }
            }
          }
          
          // Group dependencies by name
          const groupedDeps = {};
          dependencies.forEach(dep => {
            if (!groupedDeps[dep.name]) {
              groupedDeps[dep.name] = [];
            }
            groupedDeps[dep.name].push(dep);
          });
          
          return {
            dependencies,
            summary: {
              total: dependencies.length,
              unique: Object.keys(groupedDeps).length,
              byType: dependencies.reduce((acc, dep) => {
                acc[dep.type] = (acc[dep.type] || 0) + 1;
                return acc;
              }, {})
            },
            grouped: groupedDeps
          };
        }
        
        analyzeDependencies(${JSON.stringify(code)}, ${JSON.stringify(language)});
      `, {
        maxExecutionTimeMs: 5000,
        maxMemoryMB: 100,
        networkAccess: false,
        fileSystemAccess: []
      });
      
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Scan code for security vulnerabilities
   */
  async scanSecurity(req: Request, res: Response): Promise<void> {
    try {
      const { code, language = 'javascript' } = req.body;
      
      if (!code) {
        res.status(400).json({ success: false, message: 'Code is required' });
        return;
      }

      // Use VM2 to safely execute a security scanning script
      const result = await sandboxService.executeInVM2(`
        // Simple security vulnerability scanner simulation
        function scanSecurity(code, language) {
          const vulnerabilities = [];
          const lines = code.split('\\n');
          
          // Patterns to look for (simplified for demo purposes)
          const patterns = {
            javascript: [
              {
                name: 'eval-usage',
                pattern: /eval\\(/,
                severity: 'high',
                description: 'Use of eval() can lead to code injection vulnerabilities'
              },
              {
                name: 'sql-injection',
                pattern: /\\b(SELECT|INSERT|UPDATE|DELETE)\\b.*\\$\\{/i,
                severity: 'high',
                description: 'Potential SQL injection vulnerability'
              },
              {
                name: 'insecure-random',
                pattern: /Math\\.random\\(\\)/,
                severity: 'medium',
                description: 'Math.random() is not cryptographically secure'
              },
              {
                name: 'innerhtml-usage',
                pattern: /\\.innerHTML\\s*=/,
                severity: 'medium',
                description: 'Use of innerHTML can lead to XSS vulnerabilities'
              },
              {
                name: 'document-write',
                pattern: /document\\.write\\(/,
                severity: 'medium',
                description: 'document.write can lead to XSS vulnerabilities'
              },
              {
                name: 'hardcoded-secret',
                pattern: /(password|secret|api[_-]?key|auth[_-]?token)\\s*[=:]\\s*['"][^'"]{'3,}/i,
                severity: 'high',
                description: 'Potential hardcoded secret'
              }
            ],
            python: [
              {
                name: 'exec-usage',
                pattern: /\\bexec\\(/,
                severity: 'high',
                description: 'Use of exec() can lead to code injection vulnerabilities'
              },
              {
                name: 'pickle-usage',
                pattern: /\\bpickle\\b/,
                severity: 'high',
                description: 'Insecure deserialization using pickle'
              },
              {
                name: 'sql-injection',
                pattern: /\\b(SELECT|INSERT|UPDATE|DELETE)\\b.*\\% ?s/i,
                severity: 'high',
                description: 'Potential SQL injection vulnerability'
              }
            ]
          };
          
          // Select patterns based on language
          const languagePatterns = patterns[language] || patterns.javascript;
          
          // Scan for patterns
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            for (const pattern of languagePatterns) {
              if (pattern.pattern.test(line)) {
                vulnerabilities.push({
                  type: pattern.name,
                  severity: pattern.severity,
                  description: pattern.description,
                  line: i + 1,
                  code: line
                });
              }
            }
          }
          
          // Group by severity
          const bySeverity = vulnerabilities.reduce((acc, vuln) => {
            acc[vuln.severity] = (acc[vuln.severity] || 0) + 1;
            return acc;
          }, {});
          
          return {
            vulnerabilities,
            summary: {
              total: vulnerabilities.length,
              bySeverity,
              riskScore: vulnerabilities.reduce((score, vuln) => {
                return score + (vuln.severity === 'high' ? 10 : vuln.severity === 'medium' ? 5 : 1);
              }, 0)
            },
            recommendations: vulnerabilities.map(vuln => ({
              issue: vuln.description,
              location: \`Line \${vuln.line}\`,
              recommendation: vuln.type === 'eval-usage' 
                ? 'Avoid using eval(). Use safer alternatives.'
                : vuln.type === 'sql-injection'
                ? 'Use parameterized queries instead of string concatenation.'
                : vuln.type === 'insecure-random'
                ? 'Use crypto.getRandomValues() for security-sensitive operations.'
                : vuln.type === 'innerhtml-usage'
                ? 'Use textContent or createElement instead of innerHTML.'
                : vuln.type === 'document-write'
                ? 'Use DOM manipulation methods instead of document.write.'
                : vuln.type === 'hardcoded-secret'
                ? 'Store secrets in environment variables or secure vaults, not in code.'
                : vuln.type === 'exec-usage'
                ? 'Avoid using exec(). Use safer alternatives.'
                : vuln.type === 'pickle-usage'
                ? 'Use safer serialization formats like JSON.'
                : 'Review this code for security issues.'
            }))
          };
        }
        
        scanSecurity(${JSON.stringify(code)}, ${JSON.stringify(language)});
      `, {
        maxExecutionTimeMs: 5000,
        maxMemoryMB: 100,
        networkAccess: false,
        fileSystemAccess: []
      });
      
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}