#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import figlet from 'figlet';
import chalk from 'chalk';
import { createServiceLogger } from '@opencode/shared-utils';
import { findProjectRoot } from './utils/project-detection';
import { loadConfig } from './utils/simple-config';
import { chat } from './commands/chat';
import { init } from './commands/init';
import { handleListCommand } from './commands/list';
import { startCollaboration } from './commands/collab';
import { getVersion } from './utils/version';

const logger = createServiceLogger('cli');

// Create CLI program
const program = new Command();

// Display banner
console.log(
  chalk.blue(
    figlet.textSync('OpenCoded', { 
      font: 'Standard',
      horizontalLayout: 'default',
      verticalLayout: 'default'
    })
  )
);

// Setup program metadata
program
  .name('opencoded')
  .description('CLI-based AI coding assistant')
  .version(getVersion());

// Load configuration
const config = loadConfig();

// Register commands
program
  .command('chat')
  .description('Start a chat session with the AI assistant')
  .option('-p, --project <path>', 'Specify project path')
  .action(async (options) => {
    try {
      // Find project root if not specified
      const projectPath = options.project || await findProjectRoot();
      
      await chat(projectPath, config);
    } catch (error) {
      logger.error('Error in chat command', error);
      console.error(chalk.red('Error: ') + (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('init')
  .description('Initialize OpenCode configuration in the current project')
  .action(async () => {
    try {
      await init();
    } catch (error) {
      logger.error('Error in init command', error);
      console.error(chalk.red('Error: ') + (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('list [directory]')
  .description('List files in a directory using the file service API')
  .action(async (directory) => {
    try {
      await handleListCommand([directory].filter(Boolean));
    } catch (error) {
      logger.error('Error in list command', error);
      console.error(chalk.red('Error: ') + (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('collab')
  .description('Start a collaborative coding session')
  .option('-p, --project <path>', 'Specify project path')
  .option('-s, --session <id>', 'Session ID to join')
  .option('-c, --create', 'Create a new session')
  .option('-n, --name <name>', 'Name for new session')
  .option('-d, --description <description>', 'Description for new session')
  .option('-t, --team <id>', 'Team ID for shared session')
  .option('-r, --readonly', 'Join as read-only participant')
  .action(async (options) => {
    try {
      // Find project root if not specified
      const projectPath = options.project || await findProjectRoot();
      
      await startCollaboration(projectPath, {
        sessionId: options.session,
        create: options.create,
        name: options.name,
        description: options.description,
        team: options.team,
        readonly: options.readonly
      });
    } catch (error) {
      logger.error('Error in collaboration command', error);
      console.error(chalk.red('Error: ') + (error as Error).message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// If no arguments, show help
if (process.argv.length < 3) {
  program.help();
}