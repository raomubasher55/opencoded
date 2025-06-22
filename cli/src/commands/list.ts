import { terminal as term } from 'terminal-kit';
import { loadConfig } from '../utils/simple-config';
import path from 'path';
import axios from 'axios';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('list-command');

/**
 * Command to list files in a directory using the File Service API
 */
export async function handleListCommand(args: string[]): Promise<void> {
  try {
    // Get config to determine API endpoints
    const config = loadConfig();
    const fileServiceUrl = config.apiUrl?.replace('8080', '4001') || 'http://localhost:4001';
    
    // Parse arguments
    let targetDir = args[0] || process.cwd(); // Use current directory if not specified
    
    // Format the path for API call
    // Normalize the path to handle both Windows and Unix paths
    targetDir = path.normalize(targetDir);
    
    // Show loading spinner
    term.brightBlue('Listing files in: ').white(`${targetDir}\n`);
    term.spinner('dotSpinner');
    
    // Call the file service API
    try {
      const response = await axios.post(`${fileServiceUrl}/api/files/operation`, {
        operation: 'list',
        path: targetDir
      }, {
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const result = response.data;
      
      // Stop spinner
      term.spinner('stop');
      term('\n');
      
      if (result.success) {
        // Display files in a nice table format
        const files = result.data;
        
        if (!files || files.length === 0) {
          term.yellow('No files found in this directory.\n');
          return;
        }
        
        // Sort files: directories first, then alphabetically
        files.sort((a: any, b: any) => {
          if (a.isDirectory === b.isDirectory) {
            return a.name.localeCompare(b.name);
          }
          return a.isDirectory ? -1 : 1;
        });
        
        // Get the terminal width
        const termWidth = term.width();
        
        // Calculate optimal column widths
        const nameColWidth = Math.min(
          Math.max(...files.map((f: any) => f.name.length)) + 2,
          Math.floor(termWidth * 0.5)
        );
        
        const sizeColWidth = 12;
        const typeColWidth = 10;
        const dateColWidth = 20;
        
        // Print header
        term.bold.brightBlue('Name'.padEnd(nameColWidth));
        term.bold.brightBlue('Size'.padEnd(sizeColWidth));
        term.bold.brightBlue('Type'.padEnd(typeColWidth));
        term.bold.brightBlue('Last Modified'.padEnd(dateColWidth));
        term('\n');
        
        // Print divider
        term.gray('─'.repeat(nameColWidth + sizeColWidth + typeColWidth + dateColWidth));
        term('\n');
        
        // Print files
        files.forEach((file: any) => {
          const name = file.name.length > nameColWidth - 2
            ? file.name.substring(0, nameColWidth - 5) + '...'
            : file.name;
          
          // Format name with colors based on type
          if (file.isDirectory) {
            term.brightBlue(`${name}/`.padEnd(nameColWidth));
          } else {
            const ext = path.extname(file.name).toLowerCase();
            if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
              term.yellow(name.padEnd(nameColWidth));
            } else if (['.json', '.yml', '.yaml', '.toml', '.ini'].includes(ext)) {
              term.brightGreen(name.padEnd(nameColWidth));
            } else if (['.md', '.txt', '.log'].includes(ext)) {
              term.white(name.padEnd(nameColWidth));
            } else if (['.jpg', '.png', '.gif', '.svg'].includes(ext)) {
              term.brightMagenta(name.padEnd(nameColWidth));
            } else {
              term.gray(name.padEnd(nameColWidth));
            }
          }
          
          // Format size
          const sizeStr = file.isDirectory ? '--' : formatBytes(file.size);
          term.gray(sizeStr.padEnd(sizeColWidth));
          
          // Format type
          const typeStr = file.isDirectory ? 'Directory' : getFileType(file.name);
          term.gray(typeStr.padEnd(typeColWidth));
          
          // Format date
          const dateStr = new Date(file.modifiedTime).toLocaleDateString() + ' ' +
                          new Date(file.modifiedTime).toLocaleTimeString().split(' ')[0];
          term.gray(dateStr.padEnd(dateColWidth));
          
          term('\n');
        });
        
        // Print summary
        const dirCount = files.filter((f: any) => f.isDirectory).length;
        const fileCount = files.length - dirCount;
        
        term('\n');
        term.gray(`${fileCount} file(s), ${dirCount} director${dirCount === 1 ? 'y' : 'ies'}\n`);
      } else {
        term.red(`Error: ${result.error || 'Unable to list files'}\n`);
      }
    } catch (error: any) {
      // Stop spinner
      term.spinner('stop');
      term('\n');
      term.red(`Error connecting to file service: ${error.message}\n`);
      term.yellow('Make sure the file service is running and accessible.\n');
    }
  } catch (error: any) {
    logger.error('Error in list command', error);
    term.red(`Error: ${error.message}\n`);
  }
}

/**
 * Format bytes to a human-readable string
 */
function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

/**
 * Get file type from extension
 */
function getFileType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  
  const typeMap: Record<string, string> = {
    // Code
    '.js': 'JavaScript',
    '.ts': 'TypeScript',
    '.jsx': 'React JS',
    '.tsx': 'React TS',
    '.py': 'Python',
    '.java': 'Java',
    '.c': 'C',
    '.cpp': 'C++',
    '.cs': 'C#',
    '.rb': 'Ruby',
    '.go': 'Go',
    '.rs': 'Rust',
    '.php': 'PHP',
    
    // Web
    '.html': 'HTML',
    '.css': 'CSS',
    '.scss': 'SCSS',
    '.sass': 'Sass',
    
    // Config
    '.json': 'JSON',
    '.yml': 'YAML',
    '.yaml': 'YAML',
    '.toml': 'TOML',
    '.ini': 'INI',
    '.env': 'Env',
    
    // Documentation
    '.md': 'Markdown',
    '.txt': 'Text',
    '.pdf': 'PDF',
    '.docx': 'Word',
    
    // Data
    '.csv': 'CSV',
    '.xml': 'XML',
    '.sql': 'SQL',
    
    // Images
    '.jpg': 'Image',
    '.jpeg': 'Image',
    '.png': 'Image',
    '.gif': 'Image',
    '.svg': 'Vector',
    
    // Other
    '.sh': 'Shell',
    '.bat': 'Batch',
    '.log': 'Log'
  };
  
  return typeMap[ext] || 'File';
}