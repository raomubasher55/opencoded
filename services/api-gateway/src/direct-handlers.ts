import { Express, Request, Response } from 'express';
import fetch from 'node-fetch';
import { createServiceLogger } from '@opencode/shared-utils';

const logger = createServiceLogger('api-gateway-direct');

// Service URLs
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3003';
const FILE_SERVICE_URL = process.env.FILE_SERVICE_URL || 'http://localhost:4001';
const LLM_SERVICE_URL = process.env.LLM_SERVICE_URL || 'http://localhost:4002';
const SESSION_SERVICE_URL = process.env.SESSION_SERVICE_URL || 'http://localhost:4004';
const TOOLS_SERVICE_URL = process.env.TOOLS_SERVICE_URL || 'http://localhost:4003';
const COLLABORATION_SERVICE_URL = process.env.COLLABORATION_SERVICE_URL || 'http://localhost:4005';

// Timeout handling
const TIMEOUT_MS = 10000; // 10 seconds

/**
 * Create a timeout promise that rejects after the specified time
 */
const createTimeout = (ms: number) => {
  return new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Request timed out')), ms)
  );
};

/**
 * Create a generic handler that forwards requests to the specified service
 */
const createDirectHandler = (
  method: string,
  path: string,
  targetUrl: string,
  successStatus = 200
) => {
  return async (req: Request, res: Response) => {
    const fullUrl = `${targetUrl}${path.startsWith('/') ? path : '/' + path}`;
    logger.info(`Direct handling of ${method} ${path} -> ${fullUrl}`);
    
    try {
      // Prepare request options
      const options: any = {
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      // Forward authorization header if present
      if (req.headers.authorization) {
        options.headers.Authorization = req.headers.authorization;
      }
      
      // Add body for non-GET requests
      if (method !== 'GET' && method !== 'HEAD') {
        options.body = JSON.stringify(req.body);
      }
      
      // Handle query parameters
      let url = fullUrl;
      if (Object.keys(req.query).length > 0) {
        url += `?${new URLSearchParams(req.query as any).toString()}`;
      }
      
      // Make request with timeout
      const response: any = await Promise.race([
        fetch(url, options),
        createTimeout(TIMEOUT_MS)
      ]);
      
      // Check if response is ok
      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json(errorData);
      }
      
      // Return response
      const data = await response.json();
      return res.status(successStatus).json(data);
    } catch (error: any) {
      logger.error(`Error handling ${method} ${path}: ${error.message}`);
      return res.status(500).json({
        status: 'error',
        message: `Failed to ${method.toLowerCase()} ${path}`,
        details: error.message
      });
    }
  };
};

/**
 * Register all direct handlers
 */
export const registerDirectHandlers = (app: Express) => {
  // Auth Service Handlers - Auth service doesn't have an /api prefix unlike other services
  // Special case - the Auth Service routes don't have an /api prefix
  app.post('/api/auth/register', createDirectHandler('POST', '/register', AUTH_SERVICE_URL, 201));
  app.post('/api/auth/login', createDirectHandler('POST', '/login', AUTH_SERVICE_URL));
  app.post('/api/auth/refresh-token', createDirectHandler('POST', '/refresh-token', AUTH_SERVICE_URL));
  app.post('/api/auth/users/:userId/api-keys', (req, res) => {
    const path = `/users/${req.params.userId}/api-keys`;
    createDirectHandler('POST', path, AUTH_SERVICE_URL, 201)(req, res);
  });
  app.get('/api/auth/github', (req, res) => {
    res.redirect(`${AUTH_SERVICE_URL}/github`);
  });
  app.get('/api/auth/github/callback', (req, res) => {
    res.redirect(`${AUTH_SERVICE_URL}/github/callback?${new URLSearchParams(req.query as any).toString()}`);
  });
  app.get('/api/auth/google', (req, res) => {
    res.redirect(`${AUTH_SERVICE_URL}/google`);
  });
  app.get('/api/auth/google/callback', (req, res) => {
    res.redirect(`${AUTH_SERVICE_URL}/google/callback?${new URLSearchParams(req.query as any).toString()}`);
  });
  app.get('/api/auth/health', createDirectHandler('GET', '/health', AUTH_SERVICE_URL));

  // File Service Handlers
  app.get('/api/files', createDirectHandler('GET', '/api/files', FILE_SERVICE_URL));
  app.get('/api/files/read', createDirectHandler('GET', '/api/files/read', FILE_SERVICE_URL));
  app.post('/api/files/write', createDirectHandler('POST', '/api/files/write', FILE_SERVICE_URL));
  app.post('/api/files/directory', createDirectHandler('POST', '/api/files/directory', FILE_SERVICE_URL, 201));
  app.delete('/api/files', createDirectHandler('DELETE', '/api/files', FILE_SERVICE_URL));
  app.get('/api/watch', createDirectHandler('GET', '/api/watch', FILE_SERVICE_URL));
  app.get('/api/search', createDirectHandler('GET', '/api/search', FILE_SERVICE_URL));
  app.get('/api/files/health', createDirectHandler('GET', '/api/files/health', FILE_SERVICE_URL));

  // LLM Service Handlers - Based on actual LLM service implementation
  app.get('/api/llm/providers', createDirectHandler('GET', '/api/llm/providers', LLM_SERVICE_URL));
  app.get('/api/llm/config', createDirectHandler('GET', '/api/llm/config', LLM_SERVICE_URL));
  app.post('/api/llm/config', createDirectHandler('POST', '/api/llm/config', LLM_SERVICE_URL));
  app.get('/api/llm/models', createDirectHandler('GET', '/api/llm/models', LLM_SERVICE_URL));
  
  // Support both singular and plural for compatibility
  app.post('/api/llm/completion', createDirectHandler('POST', '/api/llm/completions', LLM_SERVICE_URL));
  app.post('/api/llm/completions', createDirectHandler('POST', '/api/llm/completions', LLM_SERVICE_URL));
  
  // Support both singular and plural for streaming endpoints
  app.post('/api/llm/completion/stream', createDirectHandler('POST', '/api/llm/completions/stream', LLM_SERVICE_URL));
  app.post('/api/llm/completions/stream', createDirectHandler('POST', '/api/llm/completions/stream', LLM_SERVICE_URL));
  
  app.post('/api/llm/tokens/count', createDirectHandler('POST', '/api/llm/tokens/count', LLM_SERVICE_URL));
  app.get('/api/llm/templates', createDirectHandler('GET', '/api/llm/templates', LLM_SERVICE_URL));
  app.get('/api/llm/templates/:name', (req, res) => {
    const path = `/api/llm/templates/${req.params.name}`;
    createDirectHandler('GET', path, LLM_SERVICE_URL)(req, res);
  });
  app.post('/api/llm/templates/:name', (req, res) => {
    const path = `/api/llm/templates/${req.params.name}`;
    createDirectHandler('POST', path, LLM_SERVICE_URL)(req, res);
  });
  app.delete('/api/llm/templates/:name', (req, res) => {
    const path = `/api/llm/templates/${req.params.name}`;
    createDirectHandler('DELETE', path, LLM_SERVICE_URL)(req, res);
  });
  app.post('/api/llm/templates/:name/render', (req, res) => {
    const path = `/api/llm/templates/${req.params.name}/render`;
    createDirectHandler('POST', path, LLM_SERVICE_URL)(req, res);
  });
  app.get('/api/llm/health', createDirectHandler('GET', '/health', LLM_SERVICE_URL));

  // Session Service Handlers
  app.post('/api/sessions', createDirectHandler('POST', '/api/sessions', SESSION_SERVICE_URL, 201));
  app.get('/api/sessions/:sessionId', (req, res) => {
    const path = `/api/sessions/${req.params.sessionId}`;
    createDirectHandler('GET', path, SESSION_SERVICE_URL)(req, res);
  });
  app.patch('/api/sessions/:sessionId', (req, res) => {
    const path = `/api/sessions/${req.params.sessionId}`;
    createDirectHandler('PATCH', path, SESSION_SERVICE_URL)(req, res);
  });
  app.delete('/api/sessions/:sessionId', (req, res) => {
    const path = `/api/sessions/${req.params.sessionId}`;
    createDirectHandler('DELETE', path, SESSION_SERVICE_URL)(req, res);
  });
  app.get('/api/sessions', createDirectHandler('GET', '/api/sessions', SESSION_SERVICE_URL));
  app.post('/api/sessions/:sessionId/messages', (req, res) => {
    const path = `/api/sessions/${req.params.sessionId}/messages`;
    createDirectHandler('POST', path, SESSION_SERVICE_URL, 201)(req, res);
  });
  app.get('/api/sessions/:sessionId/messages', (req, res) => {
    const path = `/api/sessions/${req.params.sessionId}/messages`;
    createDirectHandler('GET', path, SESSION_SERVICE_URL)(req, res);
  });
  app.delete('/api/sessions/:sessionId/messages/:messageId', (req, res) => {
    const path = `/api/sessions/${req.params.sessionId}/messages/${req.params.messageId}`;
    createDirectHandler('DELETE', path, SESSION_SERVICE_URL)(req, res);
  });
  app.get('/api/sessions/health', createDirectHandler('GET', '/api/sessions/health', SESSION_SERVICE_URL));

  // Tools Service Handlers
  app.get('/api/tools', createDirectHandler('GET', '/api/tools', TOOLS_SERVICE_URL));
  app.get('/api/tools/:toolId', (req, res) => {
    const path = `/api/tools/${req.params.toolId}`;
    createDirectHandler('GET', path, TOOLS_SERVICE_URL)(req, res);
  });
  app.post('/api/executions', createDirectHandler('POST', '/api/executions', TOOLS_SERVICE_URL));
  app.get('/api/executions/:executionId', (req, res) => {
    const path = `/api/executions/${req.params.executionId}`;
    createDirectHandler('GET', path, TOOLS_SERVICE_URL)(req, res);
  });
  app.post('/api/analysis', createDirectHandler('POST', '/api/analysis', TOOLS_SERVICE_URL));
  app.get('/api/analysis/:analysisId', (req, res) => {
    const path = `/api/analysis/${req.params.analysisId}`;
    createDirectHandler('GET', path, TOOLS_SERVICE_URL)(req, res);
  });
  app.post('/api/tools/:toolId/apply', (req, res) => {
    const path = `/api/tools/${req.params.toolId}/apply`;
    createDirectHandler('POST', path, TOOLS_SERVICE_URL)(req, res);
  });
  app.get('/api/tools/health', createDirectHandler('GET', '/api/tools/health', TOOLS_SERVICE_URL));

  // Collaboration Service Handlers
  // Sessions
  app.post('/api/collaboration/sessions', createDirectHandler('POST', '/api/sessions', COLLABORATION_SERVICE_URL, 201));
  app.get('/api/collaboration/sessions', createDirectHandler('GET', '/api/sessions', COLLABORATION_SERVICE_URL));
  app.get('/api/collaboration/sessions/:id', (req, res) => {
    const path = `/api/sessions/${req.params.id}`;
    createDirectHandler('GET', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.put('/api/collaboration/sessions/:id', (req, res) => {
    const path = `/api/sessions/${req.params.id}`;
    createDirectHandler('PUT', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.delete('/api/collaboration/sessions/:id', (req, res) => {
    const path = `/api/sessions/${req.params.id}`;
    createDirectHandler('DELETE', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.post('/api/collaboration/sessions/:id/join', (req, res) => {
    const path = `/api/sessions/${req.params.id}/join`;
    createDirectHandler('POST', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.post('/api/collaboration/sessions/:id/leave', (req, res) => {
    const path = `/api/sessions/${req.params.id}/leave`;
    createDirectHandler('POST', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.get('/api/collaboration/sessions/:id/participants', (req, res) => {
    const path = `/api/sessions/${req.params.id}/participants`;
    createDirectHandler('GET', path, COLLABORATION_SERVICE_URL)(req, res);
  });

  // Chat messages
  app.get('/api/collaboration/chat/sessions/:sessionId/messages', (req, res) => {
    const path = `/api/chat/sessions/${req.params.sessionId}/messages`;
    createDirectHandler('GET', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.post('/api/collaboration/chat/sessions/:sessionId/messages', (req, res) => {
    const path = `/api/chat/sessions/${req.params.sessionId}/messages`;
    createDirectHandler('POST', path, COLLABORATION_SERVICE_URL, 201)(req, res);
  });
  app.get('/api/collaboration/chat/messages/:id', (req, res) => {
    const path = `/api/chat/messages/${req.params.id}`;
    createDirectHandler('GET', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.delete('/api/collaboration/chat/messages/:id', (req, res) => {
    const path = `/api/chat/messages/${req.params.id}`;
    createDirectHandler('DELETE', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.get('/api/collaboration/chat/messages/:id/thread', (req, res) => {
    const path = `/api/chat/messages/${req.params.id}/thread`;
    createDirectHandler('GET', path, COLLABORATION_SERVICE_URL)(req, res);
  });

  // Workspaces
  app.post('/api/collaboration/workspaces', createDirectHandler('POST', '/api/workspaces', COLLABORATION_SERVICE_URL, 201));
  app.get('/api/collaboration/workspaces', createDirectHandler('GET', '/api/workspaces', COLLABORATION_SERVICE_URL));
  app.get('/api/collaboration/workspaces/:id', (req, res) => {
    const path = `/api/workspaces/${req.params.id}`;
    createDirectHandler('GET', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.put('/api/collaboration/workspaces/:id', (req, res) => {
    const path = `/api/workspaces/${req.params.id}`;
    createDirectHandler('PUT', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.delete('/api/collaboration/workspaces/:id', (req, res) => {
    const path = `/api/workspaces/${req.params.id}`;
    createDirectHandler('DELETE', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.post('/api/collaboration/workspaces/:id/members', (req, res) => {
    const path = `/api/workspaces/${req.params.id}/members`;
    createDirectHandler('POST', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.delete('/api/collaboration/workspaces/:id/members/:userId', (req, res) => {
    const path = `/api/workspaces/${req.params.id}/members/${req.params.userId}`;
    createDirectHandler('DELETE', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.put('/api/collaboration/workspaces/:id/members/:userId/role', (req, res) => {
    const path = `/api/workspaces/${req.params.id}/members/${req.params.userId}/role`;
    createDirectHandler('PUT', path, COLLABORATION_SERVICE_URL)(req, res);
  });

  // Health check
  app.get('/api/collaboration/health', createDirectHandler('GET', '/health', COLLABORATION_SERVICE_URL));

  // Comments
  app.post('/api/collaboration/comments', createDirectHandler('POST', '/api/comments', COLLABORATION_SERVICE_URL, 201));
  app.get('/api/collaboration/comments/file/:sessionId/:fileId', (req, res) => {
    const path = `/api/comments/file/${req.params.sessionId}/${req.params.fileId}`;
    createDirectHandler('GET', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.get('/api/collaboration/comments/thread/:threadId', (req, res) => {
    const path = `/api/comments/thread/${req.params.threadId}`;
    createDirectHandler('GET', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.put('/api/collaboration/comments/:commentId', (req, res) => {
    const path = `/api/comments/${req.params.commentId}`;
    createDirectHandler('PUT', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.delete('/api/collaboration/comments/:commentId', (req, res) => {
    const path = `/api/comments/${req.params.commentId}`;
    createDirectHandler('DELETE', path, COLLABORATION_SERVICE_URL)(req, res);
  });

  // Threads
  app.post('/api/collaboration/threads', createDirectHandler('POST', '/api/threads', COLLABORATION_SERVICE_URL, 201));
  app.get('/api/collaboration/threads/session/:sessionId', (req, res) => {
    const path = `/api/threads/session/${req.params.sessionId}`;
    createDirectHandler('GET', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.get('/api/collaboration/threads/file/:sessionId/:fileId', (req, res) => {
    const path = `/api/threads/file/${req.params.sessionId}/${req.params.fileId}`;
    createDirectHandler('GET', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.get('/api/collaboration/threads/:threadId', (req, res) => {
    const path = `/api/threads/${req.params.threadId}`;
    createDirectHandler('GET', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.put('/api/collaboration/threads/:threadId', (req, res) => {
    const path = `/api/threads/${req.params.threadId}`;
    createDirectHandler('PUT', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.delete('/api/collaboration/threads/:threadId', (req, res) => {
    const path = `/api/threads/${req.params.threadId}`;
    createDirectHandler('DELETE', path, COLLABORATION_SERVICE_URL)(req, res);
  });

  // Review Requests
  app.post('/api/collaboration/reviews', createDirectHandler('POST', '/api/reviews', COLLABORATION_SERVICE_URL, 201));
  app.get('/api/collaboration/reviews/session/:sessionId', (req, res) => {
    const path = `/api/reviews/session/${req.params.sessionId}`;
    createDirectHandler('GET', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.get('/api/collaboration/reviews/user', createDirectHandler('GET', '/api/reviews/user', COLLABORATION_SERVICE_URL));
  app.get('/api/collaboration/reviews/:reviewId', (req, res) => {
    const path = `/api/reviews/${req.params.reviewId}`;
    createDirectHandler('GET', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.put('/api/collaboration/reviews/:reviewId', (req, res) => {
    const path = `/api/reviews/${req.params.reviewId}`;
    createDirectHandler('PUT', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.post('/api/collaboration/reviews/:reviewId/submit', (req, res) => {
    const path = `/api/reviews/${req.params.reviewId}/submit`;
    createDirectHandler('POST', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.post('/api/collaboration/reviews/:reviewId/review', (req, res) => {
    const path = `/api/reviews/${req.params.reviewId}/review`;
    createDirectHandler('POST', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.post('/api/collaboration/reviews/:reviewId/thread/:threadId', (req, res) => {
    const path = `/api/reviews/${req.params.reviewId}/thread/${req.params.threadId}`;
    createDirectHandler('POST', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.post('/api/collaboration/reviews/:reviewId/close', (req, res) => {
    const path = `/api/reviews/${req.params.reviewId}/close`;
    createDirectHandler('POST', path, COLLABORATION_SERVICE_URL)(req, res);
  });
  app.get('/api/collaboration/reviews/:reviewId/threads', (req, res) => {
    const path = `/api/reviews/${req.params.reviewId}/threads`;
    createDirectHandler('GET', path, COLLABORATION_SERVICE_URL)(req, res);
  });

  logger.info('Registered all direct handlers');
};