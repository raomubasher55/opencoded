import chalk from 'chalk';
import * as path from 'path';
import { terminal as term } from 'terminal-kit';
import { OpenCodedConfig } from '../types/config';
import { createServiceLogger } from '@opencode/shared-utils';
import { TerminalUI } from '../utils/terminal-ui';
import { ShellIntegration } from '../utils/shell-integration';
import { Message } from '@opencode/shared-types';

// Tool execution interface (to be moved to shared-types later)
interface ToolExecution {
  id: string;
  toolId: string;
  userId: string;
  parameters: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startTime: Date;
  endTime?: Date;
  resourceUsage?: {
    executionTimeMs: number;
    maxMemoryMB: number;
    cpuPercent?: number;
  };
};
import { v4 as uuidv4 } from 'uuid';
import { RealtimeSocket, RealtimeEvent } from '../utils/realtime-socket';
import axios from 'axios';
import { SyntaxHighlighter } from '../utils/syntax-highlighter';

const logger = createServiceLogger('chat-command');

// Client for API requests
const createApiClient = (config: OpenCodedConfig) => {
  const baseURL = config.api?.url || 'http://localhost:8080';
  const apiKey = config.api?.key;
  
  return axios.create({
    baseURL,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {})
    }
  });
};

/**
 * Start an enhanced chat session with the AI assistant
 * 
 * @param projectPath Path to the project directory
 * @param config OpenCoded configuration
 */
export async function chat(projectPath: string, config: OpenCodedConfig): Promise<void> {
  // Create terminal UI instance
  const ui = new TerminalUI();
  ui.applyTheme(config);
  
  // Create API client
  const apiClient = createApiClient(config);
  
  // Create real-time socket
  const socket = new RealtimeSocket(config);
  
  // Clear screen and display header
  ui.clearScreen();
  ui.displayHeader('OpenCoded Chat Session', `Project: ${projectPath}`);
  
  // Detect available development tools
  ui.startSpinner('Analyzing project environment...');
  const devTools = await ShellIntegration.detectDevTools(projectPath);
  const shellInfo = await ShellIntegration.getShellInfo();
  ui.stopSpinnerSuccess('Project environment analyzed');
  
  // Check if user is authenticated
  let userId: string;
  
  try {
    ui.startSpinner('Authenticating...');
    const authResponse = await apiClient.get('/api/auth/me');
    userId = authResponse.data.id;
    ui.stopSpinnerSuccess(`Authenticated as ${authResponse.data.username}`);
  } catch (error) {
    ui.stopSpinnerFail('Authentication failed');
    console.error('Please login first with: opencoded login');
    return;
  }
  
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
  
  // Create or resume session
  let sessionId: string;
  let messages: Message[] = [];
  
  try {
    ui.startSpinner('Initializing session...');
    
    // Check for existing sessions
    const sessionsResponse = await apiClient.get('/api/sessions');
    const sessions = sessionsResponse.data.sessions || [];
    
    if (sessions.length > 0) {
      // Offer to resume the most recent session
      const latestSession = sessions[0];
      const resumeSession = await ui.confirm(`Resume previous session "${latestSession.title}"?`);
      
      if (resumeSession) {
        sessionId = latestSession.id;
        // Load messages from the session
        const messagesResponse = await apiClient.get(`/api/sessions/${sessionId}/messages`);
        messages = messagesResponse.data.messages || [];
      } else {
        // Create a new session
        const sessionResponse = await apiClient.post('/api/sessions', {
          title: `Project: ${path.basename(projectPath)}`,
          metadata: {
            projectPath,
            devTools: Object.entries(devTools)
              .filter(([_, available]) => available)
              .map(([name]) => name)
          }
        });
        sessionId = sessionResponse.data.id;
      }
    } else {
      // Create a new session
      const sessionResponse = await apiClient.post('/api/sessions', {
        title: `Project: ${path.basename(projectPath)}`,
        metadata: {
          projectPath,
          devTools: Object.entries(devTools)
            .filter(([_, available]) => available)
            .map(([name]) => name)
        }
      });
      sessionId = sessionResponse.data.id;
    }
    
    ui.stopSpinnerSuccess('Session initialized');
    
    // Connect to real-time socket
    await socket.connect(userId, sessionId);
    
    // Set up real-time event handlers
    setupRealtimeHandlers(socket, ui);
    
  } catch (error) {
    ui.stopSpinnerFail('Failed to initialize session');
    console.error('Error:', error);
    return;
  }
  
  // Display welcome message if this is a new session
  if (messages.length === 0) {
    // Add initial system message
    const systemMessage: Message = {
      id: uuidv4(),
      sessionId,
      role: 'system',
      content: `You are an AI coding assistant. You are helping with a project located at ${projectPath}.`,
      timestamp: new Date()
    };
    
    // Send system message to server
    await apiClient.post(`/api/sessions/${sessionId}/messages`, systemMessage);
    
    // Display welcome message
    const welcomeMessage = 'Hello! I\'m your AI coding assistant. How can I help you with your project today?\n\n' + 
      'You can ask me to:\n' +
      '- Explain code\n' +
      '- Generate new code\n' +
      '- Debug issues\n' +
      '- Answer programming questions\n' +
      '- Run commands or scripts';
    
    ui.displayAssistantMessage(welcomeMessage);
    
    // Send welcome message to server
    await apiClient.post(`/api/sessions/${sessionId}/messages`, {
      id: uuidv4(),
      sessionId,
      role: 'assistant',
      content: welcomeMessage,
      timestamp: new Date()
    });
  } else {
    // Display a few of the most recent messages for context
    const recentMessages = messages.slice(-4);
    for (const message of recentMessages) {
      if (message.role === 'user') {
        ui.displayUserMessage(message.content);
      } else if (message.role === 'assistant') {
        ui.displayAssistantMessage(message.content);
      }
    }
  }
  
  // Enhanced chat loop
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
      
      // Send user message to server
      const userMessageObj: Message = {
        id: uuidv4(),
        sessionId,
        role: 'user',
        content: userMessage,
        timestamp: new Date()
      };
      
      await apiClient.post(`/api/sessions/${sessionId}/messages`, userMessageObj);
      
      // Display AI thinking indicator
      ui.startSpinner('AI is thinking...');
      
      // Request AI response
      const responsePromise = apiClient.post('/api/llm/chat', {
        messages: [...messages, userMessageObj],
        sessionId,
        provider: config.llm?.provider,
        model: config.llm?.model,
        stream: true,  // Enable streaming response
        useTeamContext: true  // Enable team context for collaboration
      });
      
      // The actual response will come through the real-time socket
      // We just need to wait for the request to complete
      await responsePromise;
      
    } catch (error) {
      logger.error('Error in chat session', error);
      ui.stopSpinnerFail(`Error: ${(error as Error).message}`);
    }
  }
  
  // Clean up
  socket.disconnect();
  console.log(chalk.blue('\nChat session ended.'));
}

/**
 * Setup handlers for real-time events
 * @param socket Real-time socket instance
 * @param ui Terminal UI instance
 */
function setupRealtimeHandlers(socket: RealtimeSocket, ui: TerminalUI): void {
  // Handle message events
  socket.on(RealtimeEvent.MESSAGE_RECEIVED, (data: { message: Message }) => {
    const { message } = data;
    
    if (message.role === 'assistant') {
      // Stop the thinking spinner if it's active
      ui.stopSpinnerSuccess();
      
      // Display the message
      ui.displayAssistantMessage(message.content);
    }
  });
  
  // Handle streaming message chunks
  socket.on('message:chunk', (data: { chunk: string, messageId: string, done: boolean }) => {
    const { chunk, done } = data;
    
    // Stop the spinner on the first chunk
    if (ui.isSpinnerActive()) {
      ui.stopSpinnerSuccess();
    }
    
    // Display the chunk
    ui.displayMessageChunk(chunk, done);
  });
  
  // Handle tool execution events
  socket.on(RealtimeEvent.EXECUTION_STARTED, (data: { execution: ToolExecution }) => {
    ui.displaySystemMessage(`Executing ${data.execution.toolId}...`);
  });
  
  socket.on(RealtimeEvent.EXECUTION_PROGRESS, (data: { 
    execution: ToolExecution,
    progress: {
      message: string;
      percentComplete?: number;
    }
  }) => {
    const { progress } = data;
    if (progress.percentComplete !== undefined) {
      ui.updateProgressBar(progress.percentComplete, progress.message);
    } else {
      ui.displaySystemMessage(`- ${progress.message}`);
    }
  });
  
  socket.on(RealtimeEvent.EXECUTION_COMPLETED, (data: { execution: ToolExecution }) => {
    const { execution } = data;
    ui.displaySystemMessage(`Execution completed: ${execution.toolId}`);
    
    // Display the result if available
    if (execution.result) {
      if (typeof execution.result === 'string') {
        ui.displayCode(execution.result, 'bash');
      } else if (execution.result.output) {
        ui.displayCode(execution.result.output, 'bash');
      }
    }
  });
  
  socket.on(RealtimeEvent.EXECUTION_FAILED, (data: { 
    execution: ToolExecution,
    error: string
  }) => {
    ui.displayErrorMessage(`Execution failed: ${data.error}`);
  });
  
  // Handle tool output events
  socket.on(RealtimeEvent.TOOL_OUTPUT, (data: {
    executionId: string;
    type: 'stdout' | 'stderr' | 'container';
    message: string;
  }) => {
    const { type, message } = data;
    
    if (type === 'stderr') {
      ui.displayErrorMessage(message);
    } else {
      ui.displaySystemMessage(message);
    }
  });
  
  // Handle connection events
  socket.on(RealtimeEvent.DISCONNECTED, (reason: string) => {
    ui.displaySystemMessage(`Disconnected: ${reason}. Trying to reconnect...`);
  });
  
  socket.on(RealtimeEvent.CONNECTED, () => {
    ui.displaySystemMessage('Reconnected to server');
  });
  
  socket.on(RealtimeEvent.ERROR, (error: Error) => {
    ui.displayErrorMessage(`Connection error: ${error.message}`);
  });
}