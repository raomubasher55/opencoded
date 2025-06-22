import { terminal as term } from 'terminal-kit';
import { createServiceLogger } from '@opencode/shared-utils';
import { loadConfig } from '../utils/simple-config';
import path from 'path';
import WebSocket from 'ws';
import axios from 'axios';
import readline from 'readline';

const logger = createServiceLogger('collab-command');

interface CollaborationOptions {
  sessionId?: string;
  create?: boolean;
  name?: string;
  description?: string;
  team?: string;
  readonly?: boolean;
}

/**
 * Start a collaborative editing session
 */
export async function startCollaboration(
  projectPath: string,
  options: CollaborationOptions
): Promise<void> {
  try {
    // Get config for API endpoints
    const config = loadConfig();
    const apiUrl = config.apiUrl || 'http://localhost:8080';
    const collaborationServiceUrl = apiUrl.replace('8080', '4005');
    
    // Get authentication token
    const token = config.apiKey;
    
    if (!token) {
      term.red('Authentication token not found. Please login first.\n');
      return;
    }
    
    // Display banner
    term.bold.bgBlue('  OpenCoded Collaborative Coding  \n');
    term.brightBlue('Connecting to collaboration service...\n');
    
    // Get or create session
    let sessionId = options.sessionId;
    
    if (!sessionId && options.create) {
      // Create new session
      sessionId = await createNewSession(
        collaborationServiceUrl,
        token,
        options.name || path.basename(projectPath) + ' Session',
        options.description || 'Collaborative coding session',
        options.team,
        projectPath
      );
      
      if (!sessionId) {
        term.red('Failed to create collaboration session.\n');
        return;
      }
    } else if (!sessionId) {
      // List available sessions and select one
      sessionId = await selectExistingSession(collaborationServiceUrl, token);
      
      if (!sessionId) {
        term.red('No session selected. Exiting.\n');
        return;
      }
    }
    
    // Connect to the WebSocket server
    const role = options.readonly ? 'viewer' : 'editor';
    await joinSession(collaborationServiceUrl, token, sessionId, role);
    
    // Connect to WebSocket
    await connectToWebSocket(collaborationServiceUrl, token, sessionId);
  } catch (error: any) {
    logger.error('Error starting collaboration', error);
    term.red(`Error: ${error.message}\n`);
  }
}

/**
 * Create a new collaboration session
 */
async function createNewSession(
  serviceUrl: string,
  token: string,
  name: string,
  description: string,
  teamId?: string,
  projectPath?: string
): Promise<string | undefined> {
  try {
    term.spinner('dotSpinner');
    term(' Creating new collaboration session...');
    
    const response = await axios.post(`${serviceUrl}/api/sessions`, {
      name,
      description,
      visibility: teamId ? 'team' : 'private',
      teamId,
      basePath: projectPath
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = response.data;
    
    term.spinner('stop');
    term('\n');
    
    if (result && result.id) {
      term.green(`✓ Session created: ${result.name} (ID: ${result.id})\n`);
      return result.id;
    } else {
      term.red(`✗ Failed to create session: ${result.error || 'Unknown error'}\n`);
      return undefined;
    }
  } catch (error: any) {
    term.spinner('stop');
    term('\n');
    term.red(`✗ Error creating session: ${error.message}\n`);
    return undefined;
  }
}

/**
 * Select an existing collaboration session
 */
async function selectExistingSession(
  serviceUrl: string,
  token: string
): Promise<string | undefined> {
  try {
    term.spinner('dotSpinner');
    term(' Loading available sessions...');
    
    const response = await axios.get(`${serviceUrl}/api/sessions`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = response.data;
    
    term.spinner('stop');
    term('\n');
    
    if (!result || !result.sessions || result.sessions.length === 0) {
      term.yellow('No sessions available. Create a new one using --create option.\n');
      return undefined;
    }
    
    // Display available sessions
    term.bold.brightBlue('Available Sessions:\n');
    
    const sessions = result.sessions;
    
    const choices = sessions.map((session: any, index: number) => {
      const createdDate = new Date(session.createdAt).toLocaleString();
      return `${index + 1}. ${session.name} (${session.participantsCount} participants, created ${createdDate})`;
    });
    
    choices.push('Cancel');
    
    // Prompt user to select a session
    const selectedIndex = await new Promise<number>((resolve) => {
      term.singleColumnMenu(choices, (error: Error | null, response: { selectedIndex: number }) => {
        if (error) {
          resolve(-1);
          return;
        }
        resolve(response.selectedIndex);
      });
    });
    
    term('\n');
    
    if (selectedIndex === choices.length - 1 || selectedIndex === -1) {
      return undefined;
    }
    
    return sessions[selectedIndex].id;
  } catch (error: any) {
    term.spinner('stop');
    term('\n');
    term.red(`✗ Error loading sessions: ${error.message}\n`);
    return undefined;
  }
}

/**
 * Join a collaboration session
 */
async function joinSession(
  serviceUrl: string,
  token: string,
  sessionId: string,
  role: string
): Promise<boolean> {
  try {
    term.spinner('dotSpinner');
    term(' Joining session...');
    
    const response = await axios.post(`${serviceUrl}/api/sessions/${sessionId}/join`, 
      { role },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const result = response.data;
    
    term.spinner('stop');
    term('\n');
    
    if (result && result.success) {
      term.green(`✓ Joined session with role: ${result.role}\n`);
      return true;
    } else {
      term.red(`✗ Failed to join session: ${result.error || 'Unknown error'}\n`);
      return false;
    }
  } catch (error: any) {
    term.spinner('stop');
    term('\n');
    term.red(`✗ Error joining session: ${error.message}\n`);
    return false;
  }
}

/**
 * Connect to WebSocket server for real-time collaboration
 */
async function connectToWebSocket(
  serviceUrl: string,
  token: string,
  sessionId: string
): Promise<void> {
  try {
    // Connect to WebSocket
    const wsUrl = `ws://${serviceUrl.replace('http://', '')}/ws/collaboration?token=${token}&sessionId=${sessionId}`;
    
    term.brightBlue('Connecting to real-time collaboration server...\n');
    
    const ws = new WebSocket(wsUrl);
    
    // Setup readline interface for user input
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '> '
    });
    
    // Handle WebSocket events
    ws.on('open', () => {
      term.green('✓ Connected to collaboration server\n');
      term.brightBlue('Type a message and press Enter to chat.\n');
      term.brightBlue('Commands: /exit to quit, /comment to add a comment, /threads to list threads, /reviews to list reviews\n');
      
      // Initialize chat
      rl.prompt();
    });
    
    ws.on('message', (data: Buffer) => {
      try {
        // Parse message
        const message = JSON.parse(data.toString());
        
        // Handle different message types
        switch (message.type) {
          case 'user-joined':
            term.green(`\n👋 ${message.username} joined the session\n`);
            rl.prompt();
            break;
            
          case 'user-left':
            term.yellow(`\n👋 ${message.username} left the session\n`);
            rl.prompt();
            break;
            
          case 'chat-message':
            term('\n');
            term.bold.brightBlue(`${message.username}: `);
            term.white(`${message.text}\n`);
            rl.prompt();
            break;
            
          case 'cursor-update':
            // Could display where other users are in files, but keeping it minimal for the CLI
            break;
            
          case 'file-change':
            term.yellow(`\n📄 ${message.username} edited file: ${message.fileId}\n`);
            rl.prompt();
            break;
            
          case 'comment-created':
            term.yellow(`\n💬 ${message.username} added a comment`);
            if (message.lineNumber) {
              term.yellow(` at line ${message.lineNumber}`);
            }
            if (message.fileId) {
              term.yellow(` in file ${message.fileId}`);
            }
            term.yellow(':\n');
            term.white(`${message.content}\n`);
            rl.prompt();
            break;
            
          case 'comment-updated':
            term.yellow(`\n✏️ ${message.username} updated a comment: ${message.content || ''}\n`);
            if (message.status) {
              term.yellow(`Status changed to: ${message.status}\n`);
            }
            rl.prompt();
            break;
            
          case 'thread-updated':
            term.yellow(`\n📋 ${message.username} updated thread`);
            if (message.title) {
              term.yellow(` title to "${message.title}"`);
            }
            if (message.status) {
              term.yellow(` status to "${message.status}"`);
            }
            term.yellow('\n');
            rl.prompt();
            break;
            
          case 'review-request-updated':
            term.yellow(`\n📝 ${message.username} updated review request ${message.reviewId}\n`);
            if (message.status) {
              term.yellow(`Status changed to: ${message.status}\n`);
            }
            if (message.reviewerStatus) {
              term.yellow(`Reviewer status changed to: ${message.reviewerStatus}\n`);
            }
            rl.prompt();
            break;
            
          default:
            // Log unhandled message types for debugging
            logger.debug('Unhandled message type', message);
        }
      } catch (error) {
        logger.error('Error parsing WebSocket message', error);
      }
    });
    
    ws.on('error', (error) => {
      term.red(`\n✗ WebSocket error: ${error.message}\n`);
      rl.prompt();
    });
    
    ws.on('close', () => {
      term.yellow('\n✗ Disconnected from collaboration server\n');
      rl.close();
      process.exit(0);
    });
    
    // Handle user input
    rl.on('line', async (input) => {
      if (input.trim() === '/exit') {
        term.yellow('Exiting collaboration session...\n');
        ws.close();
        rl.close();
        return;
      }
      
      // Handle comment command
      if (input.trim().startsWith('/comment')) {
        await handleCommentCommand(input.substring(9), sessionId, serviceUrl, token, rl);
        return;
      }
      
      // Handle threads command
      if (input.trim() === '/threads') {
        await listThreads(sessionId, serviceUrl, token, rl);
        return;
      }
      
      // Handle reviews command
      if (input.trim() === '/reviews') {
        await listReviews(sessionId, serviceUrl, token, rl);
        return;
      }
      
      // Send chat message
      if (input.trim()) {
        ws.send(JSON.stringify({
          type: 'chat-message',
          sessionId,
          text: input
        }));
      }
      
      rl.prompt();
    });
    
    // Handle process termination
    process.on('SIGINT', () => {
      term.yellow('\nExiting collaboration session...\n');
      ws.close();
      rl.close();
      process.exit(0);
    });
  } catch (error: any) {
    logger.error('Error connecting to WebSocket', error);
    term.red(`Error: ${error.message}\n`);
  }
}

/**
 * Handle the comment command
 */
async function handleCommentCommand(
  commentText: string,
  sessionId: string,
  serviceUrl: string,
  token: string,
  rl: readline.Interface
): Promise<void> {
  try {
    term.cyan('\n--- Add Comment ---\n');
    
    // Ask for the file ID
    term.brightWhite('File ID or path: ');
    const fileId = await new Promise<string>(resolve => {
      rl.once('line', line => {
        resolve(line.trim());
      });
    });
    
    if (!fileId) {
      term.red('File ID/path is required\n');
      rl.prompt();
      return;
    }
    
    // Ask for line number (optional)
    term.brightWhite('Line number (optional): ');
    const lineNumberInput = await new Promise<string>(resolve => {
      rl.once('line', line => {
        resolve(line.trim());
      });
    });
    
    const lineNumber = lineNumberInput ? parseInt(lineNumberInput, 10) : undefined;
    
    // Ask for the comment text if not provided with the command
    let content = commentText.trim();
    if (!content) {
      term.brightWhite('Comment text: ');
      content = await new Promise<string>(resolve => {
        rl.once('line', line => {
          resolve(line.trim());
        });
      });
    }
    
    if (!content) {
      term.red('Comment text is required\n');
      rl.prompt();
      return;
    }
    
    // Create the comment
    term.spinner('dotSpinner');
    term(' Posting comment...');
    
    const response = await axios.post(`${serviceUrl}/api/comments`, {
        sessionId,
        fileId,
        content,
        lineNumber: lineNumber || undefined
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const result = response.data;
    
    term.spinner('stop');
    term('\n');
    
    if (result) {
      term.green(`✓ Comment added successfully\n`);
      
      // Send WebSocket notification about new comment
      // (This would be handled by the server in a real implementation)
      
    } else {
      term.red(`✗ Failed to add comment: ${result.error || 'Unknown error'}\n`);
    }
  } catch (error: any) {
    term.spinner('stop');
    term('\n');
    term.red(`Error adding comment: ${error.message}\n`);
  }
  
  rl.prompt();
}

/**
 * List threads for the current session
 */
async function listThreads(
  sessionId: string,
  serviceUrl: string,
  token: string,
  rl: readline.Interface
): Promise<void> {
  try {
    term.cyan('\n--- Discussion Threads ---\n');
    
    term.spinner('dotSpinner');
    term(' Loading threads...');
    
    const response = await axios.get(`${serviceUrl}/api/threads/session/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = response.data;
    
    term.spinner('stop');
    term('\n');
    
    if (!result || !result.threads || result.threads.length === 0) {
      term.yellow('No discussion threads found for this session.\n');
    } else {
      const threads = result.threads;
      
      for (let i = 0; i < threads.length; i++) {
        const thread = threads[i];
        const createdDate = new Date(thread.createdAt).toLocaleString();
        
        term.bold.white(`${i + 1}. `);
        term.bold.brightBlue(`[${thread.status}] ${thread.title}\n`);
        
        if (thread.fileId) {
          term.white(`   File: ${thread.fileId}\n`);
        }
        
        if (thread.lineNumber) {
          term.white(`   Line: ${thread.lineNumber}\n`);
        }
        
        term.gray(`   Created by ${thread.createdBy} on ${createdDate}\n`);
        term.gray(`   ${thread.participants.length} participants\n`);
        term('\n');
      }
      
      // Ask if they want to view a specific thread
      term.brightWhite('Enter thread number to view comments (or press Enter to cancel): ');
      const threadNumberInput = await new Promise<string>(resolve => {
        rl.once('line', line => {
          resolve(line.trim());
        });
      });
      
      if (threadNumberInput) {
        const threadIndex = parseInt(threadNumberInput, 10) - 1;
        
        if (threadIndex >= 0 && threadIndex < threads.length) {
          await viewThreadComments(threads[threadIndex]._id, serviceUrl, token, rl);
        }
      }
    }
  } catch (error: any) {
    term.spinner('stop');
    term('\n');
    term.red(`Error listing threads: ${error.message}\n`);
  }
  
  rl.prompt();
}

/**
 * View comments in a thread
 */
async function viewThreadComments(
  threadId: string,
  serviceUrl: string,
  token: string,
  rl: readline.Interface
): Promise<void> {
  try {
    term.cyan('\n--- Thread Comments ---\n');
    
    term.spinner('dotSpinner');
    term(' Loading thread details...');
    
    const response = await axios.get(`${serviceUrl}/api/threads/${threadId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = response.data;
    
    term.spinner('stop');
    term('\n');
    
    if (!result || !result.thread) {
      term.yellow('Thread not found.\n');
      return;
    }
    
    const { thread, comments } = result;
    
    // Display thread info
    term.bold.brightBlue(`[${thread.status}] ${thread.title}\n`);
    
    if (thread.fileId) {
      term.white(`File: ${thread.fileId}\n`);
    }
    
    if (thread.lineNumber) {
      term.white(`Line: ${thread.lineNumber}\n`);
      
      if (thread.codeSnippet) {
        term.yellow('\nCode Context:\n');
        term.brightBlack(thread.codeSnippet + '\n');
      }
    }
    
    term('\n');
    
    // Display comments
    if (!comments || comments.length === 0) {
      term.yellow('No comments in this thread yet.\n');
    } else {
      term.bold.white('Comments:\n');
      
      for (const comment of comments) {
        const commentDate = new Date(comment.createdAt).toLocaleString();
        
        term.bold.brightBlue(`${comment.username} `);
        term.gray(`(${commentDate}):\n`);
        term.white(`${comment.content}\n`);
        
        if (comment.status && comment.status !== 'open') {
          term.brightYellow(`[${comment.status}]\n`);
        }
        
        term('\n');
      }
    }
    
    // Ask if they want to reply
    term.brightWhite('Add a reply? (y/n): ');
    const addReply = await new Promise<string>(resolve => {
      rl.once('line', line => {
        resolve(line.trim().toLowerCase());
      });
    });
    
    if (addReply === 'y' || addReply === 'yes') {
      term.brightWhite('\nYour reply: ');
      const replyText = await new Promise<string>(resolve => {
        rl.once('line', line => {
          resolve(line.trim());
        });
      });
      
      if (replyText) {
        term.spinner('dotSpinner');
        term(' Posting reply...');
        
        const replyResponse = await axios.post(`${serviceUrl}/api/comments`, {
            sessionId: thread.sessionId,
            fileId: thread.fileId,
            content: replyText,
            threadId
          }, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
        
        const replyResult = replyResponse.data;
        
        term.spinner('stop');
        term('\n');
        
        if (replyResult) {
          term.green(`✓ Reply added successfully\n`);
        } else {
          term.red(`✗ Failed to add reply: ${replyResult.error || 'Unknown error'}\n`);
        }
      }
    }
  } catch (error: any) {
    term.spinner('stop');
    term('\n');
    term.red(`Error viewing thread: ${error.message}\n`);
  }
}

/**
 * List review requests for the current session
 */
async function listReviews(
  sessionId: string,
  serviceUrl: string,
  token: string,
  rl: readline.Interface
): Promise<void> {
  try {
    term.cyan('\n--- Review Requests ---\n');
    
    term.spinner('dotSpinner');
    term(' Loading review requests...');
    
    const response = await axios.get(`${serviceUrl}/api/reviews/session/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = response.data;
    
    term.spinner('stop');
    term('\n');
    
    if (!result || !result.reviewRequests || result.reviewRequests.length === 0) {
      term.yellow('No review requests found for this session.\n');
      
      // Ask if they want to create a new review request
      term.brightWhite('Create a new review request? (y/n): ');
      const createNew = await new Promise<string>(resolve => {
        rl.once('line', line => {
          resolve(line.trim().toLowerCase());
        });
      });
      
      if (createNew === 'y' || createNew === 'yes') {
        await createReviewRequest(sessionId, serviceUrl, token, rl);
      }
    } else {
      const reviews = result.reviewRequests;
      
      for (let i = 0; i < reviews.length; i++) {
        const review = reviews[i];
        const createdDate = new Date(review.createdAt).toLocaleString();
        
        term.bold.white(`${i + 1}. `);
        term.bold.brightBlue(`[${review.status}] ${review.title}\n`);
        term.white(`   ${review.description.substring(0, 50)}${review.description.length > 50 ? '...' : ''}\n`);
        term.gray(`   Created by ${review.createdBy} on ${createdDate}\n`);
        term.gray(`   ${review.reviewers.length} reviewers, ${review.files.length} files\n`);
        term('\n');
      }
      
      // Ask if they want to view a specific review
      term.brightWhite('Enter review number to view details (or press Enter to cancel): ');
      const reviewNumberInput = await new Promise<string>(resolve => {
        rl.once('line', line => {
          resolve(line.trim());
        });
      });
      
      if (reviewNumberInput) {
        const reviewIndex = parseInt(reviewNumberInput, 10) - 1;
        
        if (reviewIndex >= 0 && reviewIndex < reviews.length) {
          await viewReviewRequest(reviews[reviewIndex]._id, serviceUrl, token, rl);
        }
      }
    }
  } catch (error: any) {
    term.spinner('stop');
    term('\n');
    term.red(`Error listing review requests: ${error.message}\n`);
  }
  
  rl.prompt();
}

/**
 * Create a new review request
 */
async function createReviewRequest(
  sessionId: string,
  serviceUrl: string,
  token: string,
  rl: readline.Interface
): Promise<void> {
  try {
    term.cyan('\n--- Create Review Request ---\n');
    
    // Title
    term.brightWhite('Title: ');
    const title = await new Promise<string>(resolve => {
      rl.once('line', line => {
        resolve(line.trim());
      });
    });
    
    if (!title) {
      term.red('Title is required\n');
      rl.prompt();
      return;
    }
    
    // Description
    term.brightWhite('Description: ');
    const description = await new Promise<string>(resolve => {
      rl.once('line', line => {
        resolve(line.trim());
      });
    });
    
    if (!description) {
      term.red('Description is required\n');
      rl.prompt();
      return;
    }
    
    // For simplicity, we're not handling files and reviewers in this CLI version
    // A real implementation would allow selecting files and adding reviewers
    
    // Create the review request
    term.spinner('dotSpinner');
    term(' Creating review request...');
    
    const response = await axios.post(`${serviceUrl}/api/reviews`, {
        sessionId,
        title,
        description,
        reviewers: [],  // Simplified for CLI
        files: []       // Simplified for CLI
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const result = response.data;
    
    term.spinner('stop');
    term('\n');
    
    if (result) {
      term.green(`✓ Review request created successfully\n`);
      
      // Ask to submit the review request
      term.brightWhite('Submit this review request now? (y/n): ');
      const submitNow = await new Promise<string>(resolve => {
        rl.once('line', line => {
          resolve(line.trim().toLowerCase());
        });
      });
      
      if (submitNow === 'y' || submitNow === 'yes') {
        await submitReviewRequest(result._id, serviceUrl, token);
      }
    } else {
      term.red(`✗ Failed to create review request: ${result.error || 'Unknown error'}\n`);
    }
  } catch (error: any) {
    term.spinner('stop');
    term('\n');
    term.red(`Error creating review request: ${error.message}\n`);
  }
  
  rl.prompt();
}

/**
 * View a review request
 */
async function viewReviewRequest(
  reviewId: string,
  serviceUrl: string,
  token: string,
  rl: readline.Interface
): Promise<void> {
  try {
    term.cyan('\n--- Review Request Details ---\n');
    
    term.spinner('dotSpinner');
    term(' Loading review details...');
    
    const response = await axios.get(`${serviceUrl}/api/reviews/${reviewId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const review = response.data;
    
    term.spinner('stop');
    term('\n');
    
    if (!review) {
      term.yellow('Review request not found.\n');
      return;
    }
    
    // Display review details
    term.bold.brightBlue(`[${review.status}] ${review.title}\n`);
    term.white(`${review.description}\n\n`);
    
    const createdDate = new Date(review.createdAt).toLocaleString();
    term.gray(`Created by: ${review.createdBy} on ${createdDate}\n`);
    
    if (review.dueDate) {
      const dueDate = new Date(review.dueDate).toLocaleString();
      term.gray(`Due date: ${dueDate}\n`);
    }
    
    // Display reviewers
    if (review.reviewers && review.reviewers.length > 0) {
      term.bold.white('\nReviewers:\n');
      
      for (const reviewer of review.reviewers) {
        term.white(`- ${reviewer.username}: ${reviewer.status}`);
        if (reviewer.completedAt) {
          const completedDate = new Date(reviewer.completedAt).toLocaleString();
          term.gray(` (completed on ${completedDate})`);
        }
        term('\n');
        
        if (reviewer.comments) {
          term.gray(`  Comments: ${reviewer.comments}\n`);
        }
      }
    }
    
    // Display files
    if (review.files && review.files.length > 0) {
      term.bold.white('\nFiles:\n');
      
      for (const file of review.files) {
        term.white(`- ${file.path || file.fileId}\n`);
      }
    }
    
    // Get and display threads
    term.spinner('dotSpinner');
    term(' Loading discussion threads...');
    
    const threadsResponse = await axios.get(`${serviceUrl}/api/reviews/${reviewId}/threads`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const threadsResult = threadsResponse.data;
    
    term.spinner('stop');
    term('\n');
    
    if (threadsResult && threadsResult.threads && threadsResult.threads.length > 0) {
      term.bold.white('\nDiscussion Threads:\n');
      
      for (const thread of threadsResult.threads) {
        term.white(`- [${thread.status}] ${thread.title}\n`);
        
        if (thread.fileId) {
          term.gray(`  File: ${thread.fileId}\n`);
        }
        
        if (thread.lineNumber) {
          term.gray(`  Line: ${thread.lineNumber}\n`);
        }
      }
    } else {
      term.yellow('\nNo discussion threads for this review request.\n');
    }
  } catch (error: any) {
    term.spinner('stop');
    term('\n');
    term.red(`Error viewing review request: ${error.message}\n`);
  }
  
  rl.prompt();
}

/**
 * Submit a review request
 */
async function submitReviewRequest(
  reviewId: string,
  serviceUrl: string,
  token: string
): Promise<void> {
  try {
    term.spinner('dotSpinner');
    term(' Submitting review request...');
    
    const response = await axios.post(`${serviceUrl}/api/reviews/${reviewId}/submit`, {}, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = response.data;
    
    term.spinner('stop');
    term('\n');
    
    if (result) {
      term.green(`✓ Review request submitted successfully\n`);
    } else {
      term.red(`✗ Failed to submit review request: ${result.error || 'Unknown error'}\n`);
    }
  } catch (error: any) {
    term.spinner('stop');
    term('\n');
    term.red(`Error submitting review request: ${error.message}\n`);
  }
}