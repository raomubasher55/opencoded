import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { saveProjectConfig } from '../utils/simple-config';
import { findProjectRoot } from '../utils/project-detection';

/**
 * Initialize OpenCoded configuration in the current project
 */
export async function init(): Promise<void> {
  console.log(chalk.blue('Initializing OpenCoded in your project...'));
  
  // Find project root
  const projectRoot = await findProjectRoot();
  console.log(chalk.gray(`Project root detected at: ${projectRoot}`));
  
  // Create .opencoded directory
  const opencodedDir = path.join(projectRoot, '.opencoded');
  if (!fs.existsSync(opencodedDir)) {
    fs.mkdirSync(opencodedDir, { recursive: true });
    console.log(chalk.green('Created .opencoded directory'));
  }
  
  // Prompt for configuration
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'apiUrl',
      message: 'API URL (leave empty for default):',
      default: 'http://localhost:8080'
    },
    {
      type: 'list',
      name: 'llmProvider',
      message: 'Select LLM provider:',
      choices: ['openai', 'anthropic', 'google', 'bedrock'],
      default: 'openai'
    },
    {
      type: 'input',
      name: 'llmModel',
      message: 'Default model:',
      default: (answers: any) => {
        switch (answers.llmProvider) {
          case 'openai':
            return 'gpt-4';
          case 'anthropic':
            return 'claude-3-opus-20240229';
          case 'google':
            return 'gemini-1.0-pro';
          case 'bedrock':
            return 'anthropic.claude-3-sonnet-20240229-v1:0';
          default:
            return '';
        }
      }
    },
    {
      type: 'password',
      name: 'llmApiKey',
      message: 'API Key (leave empty to use environment variable):',
      default: ''
    },
    {
      type: 'list',
      name: 'theme',
      message: 'Select theme:',
      choices: ['light', 'dark', 'system'],
      default: 'system'
    }
  ]);
  
  // Save configuration
  const config = {
    apiUrl: answers.apiUrl,
    llm: {
      provider: answers.llmProvider,
      model: answers.llmModel,
      apiKey: answers.llmApiKey || undefined
    },
    ui: {
      theme: answers.theme as 'light' | 'dark' | 'system'
    }
  };
  
  saveProjectConfig(config, projectRoot);
  console.log(chalk.green('Configuration saved to .opencoded/config.json'));
  
  // Create .gitignore to exclude sensitive information
  const gitignorePath = path.join(opencodedDir, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, 'config.json\n*.log\n', 'utf-8');
    console.log(chalk.green('Created .opencoded/.gitignore'));
  }
  
  console.log(chalk.blue('OpenCoded initialized successfully!'));
  console.log(chalk.yellow('Tip: Add .opencoded/ to your project\'s .gitignore to avoid committing sensitive information.'));
}