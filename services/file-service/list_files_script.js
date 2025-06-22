#!/usr/bin/env node
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

// ANSI color codes
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',

  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

// API configuration
const API_HOST = 'http://localhost:4001';

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Format bytes to a human-readable string
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

// Get file type from extension
function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  const typeMap = {
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

// Execute curl command and parse the JSON response
function execCurl(url, method, data) {
  return new Promise((resolve, reject) => {
    let cmdArgs = ['-s'];
    
    if (method) {
      cmdArgs.push('-X', method);
    }
    
    if (data) {
      cmdArgs.push('-H', 'Content-Type: application/json');
      cmdArgs.push('-d', JSON.stringify(data));
    }
    
    cmdArgs.push(url);
    
    const curl = spawn('curl', cmdArgs);
    let stdout = '';
    let stderr = '';
    
    curl.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    curl.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    curl.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`curl exited with code ${code}: ${stderr}`));
      }
      
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (err) {
        reject(new Error(`Failed to parse JSON: ${err.message}`));
      }
    });
  });
}

// List files in a directory
async function listFiles(targetDir) {
  console.log(`${COLORS.bright}${COLORS.blue}Listing files in: ${COLORS.reset}${targetDir}`);
  console.log('─'.repeat(40));
  
  try {
    const result = await execCurl(`${API_HOST}/api/files/operation`, 'POST', {
      operation: 'list',
      path: targetDir
    });
    
    if (!result.success) {
      console.log(`${COLORS.red}Error: ${result.error || 'Unable to list files'}${COLORS.reset}`);
      return;
    }
    
    const files = result.data;
    
    if (!files || files.length === 0) {
      console.log(`${COLORS.yellow}No files found in this directory.${COLORS.reset}`);
      return;
    }
    
    // Sort files: directories first, then alphabetically
    files.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) {
        return a.name.localeCompare(b.name);
      }
      return a.isDirectory ? -1 : 1;
    });
    
    // Calculate column widths
    const nameColWidth = Math.min(
      Math.max(...files.map(f => f.name.length)) + 2,
      40
    );
    
    // Print header
    console.log(
      `${COLORS.bright}${COLORS.blue}${'Name'.padEnd(nameColWidth)}${'Size'.padEnd(12)}${'Type'.padEnd(12)}Last Modified${COLORS.reset}`
    );
    console.log('─'.repeat(nameColWidth + 12 + 12 + 25));
    
    // Print files
    files.forEach(file => {
      const name = file.name.length > nameColWidth - 2
        ? file.name.substring(0, nameColWidth - 5) + '...'
        : file.name;
      
      let nameColor = COLORS.gray;
      
      // Format name with colors based on type
      if (file.isDirectory) {
        nameColor = COLORS.blue;
      } else {
        const ext = path.extname(file.name).toLowerCase();
        if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
          nameColor = COLORS.yellow;
        } else if (['.json', '.yml', '.yaml', '.toml', '.ini'].includes(ext)) {
          nameColor = COLORS.green;
        } else if (['.md', '.txt', '.log'].includes(ext)) {
          nameColor = COLORS.white;
        } else if (['.jpg', '.png', '.gif', '.svg'].includes(ext)) {
          nameColor = COLORS.magenta;
        }
      }
      
      // Format size
      const sizeStr = file.isDirectory ? '--' : formatBytes(file.size);
      
      // Format type
      const typeStr = file.isDirectory ? 'Directory' : getFileType(file.name);
      
      // Format date
      const dateStr = new Date(file.modifiedTime).toLocaleDateString() + ' ' +
                      new Date(file.modifiedTime).toLocaleTimeString().split(' ')[0];
      
      console.log(
        `${nameColor}${file.isDirectory ? name + '/' : name}${COLORS.reset}`.padEnd(nameColWidth + COLORS.reset.length) +
        `${COLORS.gray}${sizeStr}${COLORS.reset}`.padEnd(12 + COLORS.reset.length) +
        `${COLORS.gray}${typeStr}${COLORS.reset}`.padEnd(12 + COLORS.reset.length) +
        `${COLORS.gray}${dateStr}${COLORS.reset}`
      );
    });
    
    // Print summary
    const dirCount = files.filter(f => f.isDirectory).length;
    const fileCount = files.length - dirCount;
    
    console.log('\n' + COLORS.gray + `${fileCount} file(s), ${dirCount} director${dirCount === 1 ? 'y' : 'ies'}` + COLORS.reset);
  } catch (err) {
    console.log(`${COLORS.red}Error: ${err.message}${COLORS.reset}`);
    console.log(`${COLORS.yellow}Make sure the file service is running and accessible.${COLORS.reset}`);
  }
}

// Interactive prompt for directory path
function promptForDirectory() {
  rl.question(`${COLORS.blue}Enter directory to list (or press Enter for current directory): ${COLORS.reset}`, async (input) => {
    const targetDir = input.trim() || process.cwd();
    
    await listFiles(targetDir);
    
    rl.question(`${COLORS.blue}List another directory? (y/n): ${COLORS.reset}`, (answer) => {
      if (answer.toLowerCase() === 'y') {
        promptForDirectory();
      } else {
        rl.close();
      }
    });
  });
}

// Check if directory was passed as an argument
const args = process.argv.slice(2);
if (args.length > 0) {
  listFiles(args[0])
    .then(() => rl.close())
    .catch((err) => {
      console.error(err);
      rl.close();
    });
} else {
  promptForDirectory();
}