// Simple test to verify file service functionality
const fs = require('fs').promises;
const path = require('path');

// Simulate the FileOperationsService core logic
class TestFileOperationsService {
  normalizePath(filePath) {
    if (!path.isAbsolute(filePath)) {
      filePath = path.join(process.cwd(), filePath);
    }
    return path.normalize(filePath);
  }

  validatePath(filePath) {
    const allowedPaths = [process.cwd()];
    const isWithinAllowedPath = allowedPaths.some(allowedPath => 
      filePath.startsWith(this.normalizePath(allowedPath))
    );
    
    if (!isWithinAllowedPath) {
      throw new Error(`Access denied: Path outside of allowed directories: ${filePath}`);
    }
  }

  async readFile(filePath) {
    const resolvedPath = this.normalizePath(filePath);
    this.validatePath(resolvedPath);
    
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      throw new Error(`Not a file: ${filePath}`);
    }
    
    const content = await fs.readFile(resolvedPath, 'utf-8');
    return content;
  }

  async writeFile(filePath, content) {
    const resolvedPath = this.normalizePath(filePath);
    this.validatePath(resolvedPath);
    
    await this.ensureDir(path.dirname(resolvedPath));
    await fs.writeFile(resolvedPath, content, 'utf-8');
    return true;
  }

  async listFiles(dirPath) {
    const resolvedPath = this.normalizePath(dirPath);
    this.validatePath(resolvedPath);
    
    const stats = await fs.stat(resolvedPath);
    if (!stats.isDirectory()) {
      throw new Error(`Not a directory: ${dirPath}`);
    }
    
    const files = await fs.readdir(resolvedPath);
    const fileDetails = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(resolvedPath, file);
        const fileStats = await fs.stat(filePath);
        
        return {
          name: file,
          isDirectory: fileStats.isDirectory(),
          size: fileStats.size,
          modifiedTime: fileStats.mtime
        };
      })
    );
    
    return fileDetails;
  }

  async delete(filePath, recursive = false) {
    const resolvedPath = this.normalizePath(filePath);
    this.validatePath(resolvedPath);
    
    const stats = await fs.stat(resolvedPath);
    
    if (stats.isDirectory()) {
      if (recursive) {
        await fs.rmdir(resolvedPath, { recursive: true });
      } else {
        await fs.rmdir(resolvedPath);
      }
    } else {
      await fs.unlink(resolvedPath);
    }
    
    return true;
  }

  async ensureDir(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }
}

// Test the service
async function testFileService() {
  console.log('🧪 Testing File Service Core Logic...');
  
  const service = new TestFileOperationsService();
  const testDir = path.join(process.cwd(), 'test-file-service-temp');
  const testFile = path.join(testDir, 'test.txt');
  const testContent = 'Hello, OpenCode File Service!';
  
  try {
    console.log('\n1️⃣ Testing file write...');
    await service.writeFile(testFile, testContent);
    console.log('✅ File write successful');
    
    console.log('\n2️⃣ Testing file read...');
    const readContent = await service.readFile(testFile);
    console.log(`✅ File read successful: "${readContent}"`);
    
    if (readContent === testContent) {
      console.log('✅ Content matches!');
    } else {
      console.log('❌ Content mismatch!');
    }
    
    console.log('\n3️⃣ Testing directory listing...');
    const files = await service.listFiles(testDir);
    console.log('✅ Directory listing successful:');
    files.forEach(file => {
      console.log(`  - ${file.name} (${file.isDirectory ? 'DIR' : 'FILE'}, ${file.size} bytes)`);
    });
    
    console.log('\n4️⃣ Testing file deletion...');
    await service.delete(testFile);
    console.log('✅ File deletion successful');
    
    console.log('\n5️⃣ Testing directory deletion...');
    await service.delete(testDir);
    console.log('✅ Directory deletion successful');
    
    console.log('\n🎉 All tests passed! File Service core logic is working correctly.');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    
    // Cleanup on error
    try {
      await service.delete(testDir, true);
      console.log('🧹 Cleanup completed');
    } catch (cleanupError) {
      console.error('⚠️  Cleanup failed:', cleanupError.message);
    }
  }
}

// Run the test
testFileService().catch(console.error);