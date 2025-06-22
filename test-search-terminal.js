// Test script for search and terminal functionality
const fs = require('fs').promises;
const path = require('path');

// Test data setup
const testDir = path.join(process.cwd(), 'test-search-terminal-temp');
const testFiles = [
  { name: 'app.js', content: 'const express = require("express");\napp.listen(3000);' },
  { name: 'config.json', content: '{"port": 3000, "debug": true}' },
  { name: 'package.json', content: '{"name": "test-app", "scripts": {"dev": "npm start"}}' }
];

// Simulate search functionality (based on SearchService logic)
class TestSearchService {
  async searchInFiles(pattern, searchPath, options = {}) {
    const results = [];
    
    try {
      // Get all files in directory
      const files = await fs.readdir(searchPath);
      
      for (const file of files) {
        const filePath = path.join(searchPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split(/\r?\n/);
          
          // Create regex from pattern
          const regexFlags = options.caseSensitive ? 'g' : 'gi';
          const regex = new RegExp(pattern, regexFlags);
          
          // Search each line
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            let match;
            regex.lastIndex = 0;
            
            while ((match = regex.exec(line)) !== null) {
              results.push({
                file: filePath,
                line: i + 1,
                content: line,
                column: match.index,
                matchLength: match[0].length
              });
            }
          }
        }
      }
      
      return results;
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }
}

// Simulate terminal functionality (basic version)
class TestTerminalService {
  async executeCommand(command, options = {}) {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Basic security validation
    const dangerousCommands = ['rm', 'del', 'format', 'shutdown', 'reboot'];
    const baseCommand = command.trim().split(/\s+/)[0].toLowerCase();
    
    if (dangerousCommands.includes(baseCommand)) {
      throw new Error(`Command '${baseCommand}' is not allowed for security reasons`);
    }
    
    try {
      const startTime = Date.now();
      const execOptions = {
        cwd: options.cwd || process.cwd(),
        timeout: options.timeout || 30000
      };
      
      const { stdout, stderr } = await execAsync(command, execOptions);
      
      return {
        stdout: stdout.toString(),
        stderr: stderr.toString(),
        exitCode: 0,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        stdout: error.stdout?.toString() || '',
        stderr: error.stderr?.toString() || error.message,
        exitCode: error.code || 1,
        executionTime: Date.now() - startTime || 0
      };
    }
  }
}

// Test functions
async function testSearchFunctionality() {
  console.log('🔍 Testing Search Functionality...');
  
  const searchService = new TestSearchService();
  
  try {
    console.log('\n1️⃣ Testing search for "express" pattern...');
    const results = await searchService.searchInFiles('express', testDir);
    
    if (results.length > 0) {
      console.log('✅ Search successful! Found matches:');
      results.forEach(match => {
        console.log(`  - ${path.basename(match.file)}:${match.line}:${match.column} "${match.content.trim()}"`);
      });
    } else {
      console.log('❌ No matches found');
    }
    
    console.log('\n2️⃣ Testing search for "port" pattern...');
    const portResults = await searchService.searchInFiles('port', testDir);
    
    if (portResults.length > 0) {
      console.log('✅ Search successful! Found matches:');
      portResults.forEach(match => {
        console.log(`  - ${path.basename(match.file)}:${match.line}:${match.column} "${match.content.trim()}"`);
      });
    } else {
      console.log('❌ No matches found');
    }
    
    console.log('\n3️⃣ Testing case-sensitive search...');
    const caseResults = await searchService.searchInFiles('EXPRESS', testDir, { caseSensitive: true });
    console.log(`✅ Case-sensitive search completed (${caseResults.length} matches)`);
    
  } catch (error) {
    console.error('❌ Search test failed:', error.message);
  }
}

async function testTerminalFunctionality() {
  console.log('\n🖥️  Testing Terminal Functionality...');
  
  const terminalService = new TestTerminalService();
  
  try {
    console.log('\n1️⃣ Testing "echo" command...');
    const echoResult = await terminalService.executeCommand('echo "Hello from terminal!"');
    
    if (echoResult.exitCode === 0) {
      console.log('✅ Echo command successful!');
      console.log(`  Output: ${echoResult.stdout.trim()}`);
      console.log(`  Execution time: ${echoResult.executionTime}ms`);
    } else {
      console.log('❌ Echo command failed');
      console.log(`  Error: ${echoResult.stderr}`);
    }
    
    console.log('\n2️⃣ Testing "pwd" (current directory) command...');
    const pwdCommand = process.platform === 'win32' ? 'cd' : 'pwd';
    const pwdResult = await terminalService.executeCommand(pwdCommand);
    
    if (pwdResult.exitCode === 0) {
      console.log('✅ Directory command successful!');
      console.log(`  Current directory: ${pwdResult.stdout.trim()}`);
    } else {
      console.log('❌ Directory command failed');
      console.log(`  Error: ${pwdResult.stderr}`);
    }
    
    console.log('\n3️⃣ Testing "ls/dir" (list files) command...');
    const listCommand = process.platform === 'win32' ? 'dir /b' : 'ls -la';
    const listResult = await terminalService.executeCommand(listCommand, { cwd: testDir });
    
    if (listResult.exitCode === 0) {
      console.log('✅ List files command successful!');
      console.log(`  Files in test directory:\n${listResult.stdout}`);
    } else {
      console.log('❌ List files command failed');
      console.log(`  Error: ${listResult.stderr}`);
    }
    
    console.log('\n4️⃣ Testing security validation (dangerous command)...');
    try {
      await terminalService.executeCommand('rm -rf /tmp/fake');
      console.log('❌ Security validation failed - dangerous command was allowed!');
    } catch (error) {
      console.log('✅ Security validation successful - dangerous command blocked');
      console.log(`  Error: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Terminal test failed:', error.message);
  }
}

// Main test function
async function runTests() {
  console.log('🧪 Testing Search and Terminal Functionality...');
  console.log('================================================');
  
  try {
    // Setup test environment
    console.log('\n📁 Setting up test environment...');
    await fs.mkdir(testDir, { recursive: true });
    
    // Create test files
    for (const file of testFiles) {
      const filePath = path.join(testDir, file.name);
      await fs.writeFile(filePath, file.content, 'utf-8');
    }
    console.log('✅ Test files created successfully');
    
    // Run search tests
    await testSearchFunctionality();
    
    // Run terminal tests
    await testTerminalFunctionality();
    
    console.log('\n🎉 All tests completed!');
    
  } catch (error) {
    console.error('\n❌ Test setup failed:', error.message);
  } finally {
    // Cleanup
    try {
      console.log('\n🧹 Cleaning up test environment...');
      await fs.rm(testDir, { recursive: true, force: true });
      console.log('✅ Cleanup completed');
    } catch (cleanupError) {
      console.error('⚠️  Cleanup failed:', cleanupError.message);
    }
  }
}

// Run the tests
runTests().catch(console.error);