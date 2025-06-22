import fs from 'fs';
import path from 'path';

/**
 * Get the current version of the CLI tool
 */
export function getVersion(): string {
  try {
    // First, try to read package.json from the current directory (dev mode)
    const packageJsonPath = path.resolve(__dirname, '..', '..', 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      return packageJson.version;
    }
    
    // If that fails, try to read package.json from the installed location
    const installedPackageJsonPath = path.resolve(__dirname, '..', 'package.json');
    
    if (fs.existsSync(installedPackageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(installedPackageJsonPath, 'utf-8'));
      return packageJson.version;
    }
    
    return '0.1.0'; // Fallback version
  } catch (error) {
    return '0.1.0'; // Fallback version
  }
}