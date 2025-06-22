import chalk from 'chalk';
import { terminal as term } from 'terminal-kit';
import { OpenCodedConfig } from '../types/config';
import { createServiceLogger } from '@opencode/shared-utils';
import { TerminalUI } from '../utils/terminal-ui';
import { ShellIntegration } from '../utils/shell-integration';
import { Message, LlmRequest } from '@opencode/shared-types';
import { v4 as uuidv4 } from 'uuid';
import { LlmServiceClient } from '../services/llm.service';

const logger = createServiceLogger('chat-command');

/**
 * Start a chat session with the AI assistant
 * 
 * @param projectPath Path to the project directory
 * @param config OpenCoded configuration
 */
export async function chat(projectPath: string, config: OpenCodedConfig): Promise<void> {
  // Create terminal UI instance
  const ui = new TerminalUI();
  ui.applyTheme(config);
  
  // Clear screen and display header
  ui.clearScreen();
  ui.displayHeader('OpenCoded Chat Session', `Project: ${projectPath}`);
  
  // Detect available development tools
  ui.startSpinner('Analyzing project environment...');
  const devTools = await ShellIntegration.detectDevTools(projectPath);
  const shellInfo = await ShellIntegration.getShellInfo();
  ui.stopSpinnerSuccess('Project environment analyzed');
  
  // Display system info
  ui.displaySystemMessage(`Model: ${config.llm?.provider || 'openai'}/${config.llm?.model || 'gpt-4'}`);
  ui.displaySystemMessage(`Shell: ${shellInfo.name} (${shellInfo.version})`);
  ui.displaySystemMessage('Available tools: ' + 
    Object.entries(devTools)
      .filter(([_, available]) => available)
      .map(([name]) => name)
      .join(', ')
  );
  ui.displaySystemMessage('Type "exit" or press Ctrl+C to quit');
  
  // Display welcome message
  ui.displayAssistantMessage(
    'Hello! I\'m your AI coding assistant. How can I help you with your project today?\n\n' + 
    'You can ask me to:\n' +
    '- Explain code\n' +
    '- Generate new code\n' +
    '- Debug issues\n' +
    '- Answer programming questions\n' +
    '- Run commands or scripts'
  );
  
  // Initialize a mock session (in a real implementation, this would connect to the session service)
  const sessionId = uuidv4();
  const messages: Message[] = [];
  
  // Add initial system message
  messages.push({
    id: uuidv4(),
    sessionId,
    role: 'system',
    content: `You are an AI coding assistant. You are helping with a project located at ${projectPath}.`,
    timestamp: new Date()
  });
  
  // Simple chat loop
  let conversationActive = true;
  
  while (conversationActive) {
    try {
      // Get user input
      const userMessage = await ui.getUserInput('\nYou: ');
      term('\n');
      
      // Handle exit command
      if (userMessage.toLowerCase() === 'exit') {
        conversationActive = false;
        break;
      }
      
      // Add user message to the conversation
      messages.push({
        id: uuidv4(),
        sessionId,
        role: 'user',
        content: userMessage,
        timestamp: new Date()
      });
      
      // Display AI thinking indicator
      ui.startSpinner('AI is thinking...');
      
      // Call the LLM service with fallback to simulation
      try {
        await callLlmService(ui, messages, config, projectPath);
      } catch (error) {
        logger.warn('Failed to connect to LLM service, falling back to simulation', error);
        ui.displaySystemMessage('Failed to connect to LLM service. Using simulated responses.');
        const userMessage = messages[messages.length - 1].content;
        await simulateAiResponse(ui, userMessage, messages, projectPath);
      }
      
      // Stop spinner
      ui.stopSpinnerSuccess();
      
    } catch (error) {
      logger.error('Error in chat session', error);
      ui.stopSpinnerFail(`Error: ${(error as Error).message}`);
    }
  }
  
  console.log(chalk.blue('\nChat session ended.'));
}

/**
 * Call the LLM service to get an AI response
 */
async function callLlmService(
  ui: TerminalUI,
  messages: Message[],
  config: OpenCodedConfig,
  projectPath: string
): Promise<void> {
  try {
    // Initialize LLM service client
    const apiUrl = config.apiUrl || 'http://localhost:8080';
    const apiKey = config.apiKey || '';
    const llmClient = new LlmServiceClient(apiUrl, apiKey);
    
    // Create LLM request
    const request: LlmRequest = {
      messages,
      options: {
        temperature: 0.7,
        maxTokens: 2000,
        useTeamContext: true,
        tools: [
          {
            name: 'execute_command',
            description: 'Execute a shell command in the user\'s project directory',
            parameters: {
              type: 'object',
              properties: {
                command: {
                  type: 'string',
                  description: 'The command to execute'
                },
                args: {
                  type: 'array',
                  items: {
                    type: 'string'
                  },
                  description: 'Arguments for the command'
                }
              },
              required: ['command']
            }
          },
          {
            name: 'list_files',
            description: 'List files in a directory within the project',
            parameters: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'Relative path within the project to list files from'
                }
              },
              required: ['path']
            }
          }
        ]
      }
    };
    
    let responseContent = '';
    let hasPendingText = false;
    let codeBlock = {
      inProgress: false,
      language: '',
      content: ''
    };
    
    // Stream the response
    await llmClient.createStreamingCompletion(
      request,
      (content) => {
        // Simple markdown code block detection
        if (content.includes('```') && !codeBlock.inProgress) {
          // Start of code block
          const parts = content.split('```');
          responseContent += parts[0];
          
          if (parts.length > 1) {
            // Extract language if specified
            const langLine = parts[1].split('\n')[0].trim();
            codeBlock.language = langLine;
            codeBlock.inProgress = true;
            codeBlock.content = parts[1].substring(langLine.length + 1);
          }
          
          // Display any text before the code block
          if (responseContent.trim() !== '') {
            if (hasPendingText) {
              ui.stopSpinnerSuccess();
              hasPendingText = false;
            }
            ui.displayAssistantMessage(responseContent.trim());
            responseContent = '';
          }
        } else if (content.includes('```') && codeBlock.inProgress) {
          // End of code block
          const parts = content.split('```');
          codeBlock.content += parts[0];
          
          // Display the code block
          ui.displayCode(codeBlock.content, codeBlock.language, {
            title: 'Code',
            showLineNumbers: true
          });
          
          // Reset code block and start accumulating regular text again
          codeBlock.inProgress = false;
          codeBlock.language = '';
          codeBlock.content = '';
          
          if (parts.length > 1) {
            responseContent = parts[1];
          }
        } else if (codeBlock.inProgress) {
          // Continue accumulating code block content
          codeBlock.content += content;
        } else {
          // Regular text content
          responseContent += content;
          hasPendingText = true;
        }
      },
      async (toolCall) => {
        // Handle tool calls
        if (toolCall.function.name === 'execute_command') {
          try {
            // Parse tool call arguments
            const args = JSON.parse(toolCall.function.arguments);
            const command = args.command;
            const commandArgs = args.args || [];
            
            // Display the command that will be executed
            if (responseContent.trim() !== '') {
              ui.stopSpinnerSuccess();
              ui.displayAssistantMessage(responseContent.trim());
              responseContent = '';
              hasPendingText = false;
            }
            
            ui.displaySystemMessage(`Executing command: ${command} ${commandArgs.join(' ')}`);
            
            // Execute the command
            ui.startSpinner('Running command...');
            const result = await ShellIntegration.executeCommand(command, commandArgs, {
              cwd: projectPath,
              captureOutput: true
            });
            ui.stopSpinnerSuccess('Command executed');
            
            // Display the output
            if (result.stdout.trim() !== '') {
              ui.displaySystemMessage('Command output:');
              ui.displayCode(result.stdout, 'bash');
            }
            
            if (result.stderr.trim() !== '') {
              ui.displaySystemMessage('Command error output:');
              ui.displayCode(result.stderr, 'bash');
            }
            
            // Send the tool result back to the LLM service
            const toolResult = {
              stdout: result.stdout,
              stderr: result.stderr,
              exitCode: result.code
            };
            
            // Add the tool result as a tool message
            messages.push({
              id: uuidv4(),
              sessionId: messages[0].sessionId,
              role: 'tool',
              content: JSON.stringify(toolResult),
              toolCalls: [{ id: toolCall.id, name: toolCall.function.name, arguments: toolCall.function.arguments }],
              timestamp: new Date()
            });
          } catch (error) {
            logger.error('Error executing command', error);
            ui.displaySystemMessage(`Error executing command: ${(error as Error).message}`);
          }
        } else if (toolCall.function.name === 'list_files') {
          try {
            // Parse tool call arguments
            const args = JSON.parse(toolCall.function.arguments);
            const path = args.path || '.';
            
            // Display the path being listed
            if (responseContent.trim() !== '') {
              ui.stopSpinnerSuccess();
              ui.displayAssistantMessage(responseContent.trim());
              responseContent = '';
              hasPendingText = false;
            }
            
            ui.displaySystemMessage(`Listing files in: ${path}`);
            
            // List files
            const fullPath = `${projectPath}/${path}`;
            ui.startSpinner('Reading directory...');
            const { stdout } = await ShellIntegration.executeCommand('ls', ['-la', fullPath], {
              captureOutput: true
            });
            ui.stopSpinnerSuccess('Directory read');
            
            // Parse the output to get file info
            const lines = stdout.split('\n').filter(line => line.trim() !== '');
            const fileInfo = lines.slice(1).map(line => {
              const parts = line.split(/\s+/);
              const name = parts.slice(8).join(' ');
              return [name, parts[4], parts[5] + ' ' + parts[6] + ' ' + parts[7]];
            });
            
            // Display the file list as a table
            ui.displayTable(['Name', 'Size', 'Modified'], fileInfo);
            
            // Send the tool result back to the LLM service
            const toolResult = {
              files: fileInfo.map(f => ({ name: f[0], size: f[1], modified: f[2] }))
            };
            
            // Add the tool result as a tool message
            messages.push({
              id: uuidv4(),
              sessionId: messages[0].sessionId,
              role: 'tool',
              content: JSON.stringify(toolResult),
              toolCalls: [{ id: toolCall.id, name: toolCall.function.name, arguments: toolCall.function.arguments }],
              timestamp: new Date()
            });
          } catch (error) {
            logger.error('Error listing files', error);
            ui.displaySystemMessage(`Error listing files: ${(error as Error).message}`);
          }
        }
      }
    );
    
    // Display any remaining response text
    if (responseContent.trim() !== '') {
      if (hasPendingText) {
        ui.stopSpinnerSuccess();
      }
      ui.displayAssistantMessage(responseContent.trim());
    }
    
    // Add the complete response to messages
    messages.push({
      id: uuidv4(),
      sessionId: messages[0].sessionId,
      role: 'assistant',
      content: responseContent,
      timestamp: new Date()
    });
    
  } catch (error) {
    logger.error('Error calling LLM service', error);
    throw error;
  }
}

/**
 * Simulate an AI response (fallback if LLM service is unavailable)
 */
async function simulateAiResponse(
  ui: TerminalUI, 
  userMessage: string,
  messages: Message[],
  projectPath: string
): Promise<void> {
  // Add a slight delay to simulate thinking
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Generate a placeholder response based on user message
  let response = '';
  
  if (userMessage.toLowerCase().includes('help')) {
    response = 'I can help you with coding tasks, explaining code, or generating new code. What would you like assistance with?';
  }
  else if (userMessage.toLowerCase().includes('explain') || userMessage.toLowerCase().includes('what')) {
    response = 'This would be an explanation of the code or concept you asked about. In the full implementation, I would analyze your code and provide detailed explanations.';
  }
  else if (userMessage.toLowerCase().includes('generate') || userMessage.toLowerCase().includes('create')) {
    // Show syntax highlighting example
    const codeExample = `function calculateSum(a, b) {
  // Add two numbers together
  return a + b;
}

// Example usage
const result = calculateSum(5, 10);
console.log(\`The sum is: \${result}\`);`;
    
    response = 'Here\'s an example of the code you requested:';
    ui.stopSpinnerSuccess();
    
    ui.displayAssistantMessage(response);
    ui.displayCode(codeExample, 'javascript', {
      title: 'Example Code',
      showLineNumbers: true,
      highlight: [2, 7]
    });
    
    return;
  }
  else if (userMessage.toLowerCase().includes('run') || userMessage.toLowerCase().includes('execute')) {
    response = 'In the full implementation, I could help you run commands or scripts directly from this chat interface.';
    
    // Show command execution example
    ui.stopSpinnerSuccess();
    ui.displayAssistantMessage(response);
    
    ui.startSpinner('Executing command...');
    const result = await ShellIntegration.executeCommand('echo', ['Running a simulated command'], {
      captureOutput: true
    });
    ui.stopSpinnerSuccess('Command executed');
    
    ui.displaySystemMessage('Command output:');
    ui.displayCode(result.stdout, 'bash');
    
    return;
  }
  else if (userMessage.toLowerCase().includes('list files') || userMessage.toLowerCase().includes('show files')) {
    response = 'Here\'s a list of files in your project (simulated):';
    
    ui.stopSpinnerSuccess();
    ui.displayAssistantMessage(response);
    
    const fileTable = [
      ['src/index.js', '2 KB', '1 hour ago'],
      ['src/components/App.js', '5 KB', '2 days ago'],
      ['package.json', '1 KB', '1 week ago'],
      ['README.md', '3 KB', '3 weeks ago']
    ];
    
    ui.displayTable(['File', 'Size', 'Modified'], fileTable);
    
    return;
  }
  else {
    response = 'I understand your request. In the full implementation, I would provide a helpful response based on your project context and the specific task you\'ve asked for.';
  }
  
  // Add assistant message to the conversation
  messages.push({
    id: uuidv4(),
    sessionId: messages[0].sessionId,
    role: 'assistant',
    content: response,
    timestamp: new Date()
  });
  
  // Display the response
  ui.displayAssistantMessage(response);
}