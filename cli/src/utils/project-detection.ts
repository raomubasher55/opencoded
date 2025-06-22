import fs from 'fs';
import path from 'path';

// Common project root indicators
const PROJECT_INDICATORS = [
  // Version control
  '.git',
  '.hg',
  '.svn',
  
  // Package managers
  'package.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'composer.json',
  'Gemfile',
  'requirements.txt',
  'go.mod',
  'Cargo.toml',
  
  // Project config files
  '.eslintrc',
  'tsconfig.json',
  'pyproject.toml',
  'setup.py',
  'Makefile',
  'CMakeLists.txt',
  
  // IDE/Editor configs
  '.vscode',
  '.idea',
  '.editorconfig'
];

/**
 * Find the project root directory by traversing up from the current directory
 * looking for common project indicators
 * 
 * @returns The absolute path to the project root
 */
export async function findProjectRoot(startPath = process.cwd()): Promise<string> {
  let currentPath = startPath;
  const root = path.parse(currentPath).root;
  
  // Traverse up the directory tree until we find a project indicator or hit the filesystem root
  while (currentPath !== root) {
    // Check if any project indicator exists in the current directory
    for (const indicator of PROJECT_INDICATORS) {
      const indicatorPath = path.join(currentPath, indicator);
      if (fs.existsSync(indicatorPath)) {
        return currentPath;
      }
    }
    
    // Move up one level
    const parentPath = path.dirname(currentPath);
    
    // If we've reached the root, break
    if (parentPath === currentPath) {
      break;
    }
    
    currentPath = parentPath;
  }
  
  // If no project root found, return the current directory
  return startPath;
}

/**
 * Determine if a path is within a Git repository
 */
export function isGitRepository(projectPath: string): boolean {
  const gitPath = path.join(projectPath, '.git');
  return fs.existsSync(gitPath);
}

/**
 * Determine the project type based on files in the directory
 * Returns an array of detected project types
 */
export function detectProjectType(projectPath: string): string[] {
  const projectTypes: string[] = [];
  
  // Check for JavaScript/TypeScript
  if (
    fs.existsSync(path.join(projectPath, 'package.json')) ||
    fs.existsSync(path.join(projectPath, 'tsconfig.json'))
  ) {
    projectTypes.push('javascript');
    
    // Check for TypeScript
    if (fs.existsSync(path.join(projectPath, 'tsconfig.json'))) {
      projectTypes.push('typescript');
    }
    
    // Check for common frameworks
    const packageJsonPath = path.join(projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        if (deps.react) projectTypes.push('react');
        if (deps.vue) projectTypes.push('vue');
        if (deps.angular) projectTypes.push('angular');
        if (deps.express) projectTypes.push('express');
        if (deps.next) projectTypes.push('nextjs');
        if (deps.gatsby) projectTypes.push('gatsby');
      } catch (error) {
        // Ignore package.json parsing errors
      }
    }
  }
  
  // Check for Python
  if (
    fs.existsSync(path.join(projectPath, 'requirements.txt')) ||
    fs.existsSync(path.join(projectPath, 'pyproject.toml')) ||
    fs.existsSync(path.join(projectPath, 'setup.py'))
  ) {
    projectTypes.push('python');
    
    // Check for common frameworks
    if (fs.existsSync(path.join(projectPath, 'manage.py'))) {
      projectTypes.push('django');
    }
    
    if (fs.existsSync(path.join(projectPath, 'app.py'))) {
      projectTypes.push('flask');
    }
  }
  
  // Check for Java/Kotlin
  if (
    fs.existsSync(path.join(projectPath, 'pom.xml')) ||
    fs.existsSync(path.join(projectPath, 'build.gradle'))
  ) {
    projectTypes.push('java');
    
    // Check for Kotlin
    const files = fs.readdirSync(projectPath);
    if (files.some(file => file.endsWith('.kt') || file.endsWith('.kts'))) {
      projectTypes.push('kotlin');
    }
    
    // Check for Spring
    if (
      fs.existsSync(path.join(projectPath, 'src', 'main', 'resources', 'application.properties')) ||
      fs.existsSync(path.join(projectPath, 'src', 'main', 'resources', 'application.yml'))
    ) {
      projectTypes.push('spring');
    }
  }
  
  // Check for Go
  if (fs.existsSync(path.join(projectPath, 'go.mod'))) {
    projectTypes.push('go');
  }
  
  // Check for Rust
  if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) {
    projectTypes.push('rust');
  }
  
  return projectTypes;
}