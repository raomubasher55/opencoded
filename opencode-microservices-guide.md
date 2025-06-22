# OpenCode AI Assistant: Complete Microservices Implementation Guide with TypeScript and Express

## Table of Contents
1. [Introduction and Architecture Overview](#1-introduction-and-architecture-overview)
2. [Complete OpenCode Tools List](#2-complete-opencode-tools-list)
3. [Microservices Architecture Design](#3-microservices-architecture-design)
4. [Core Technology Stack](#4-core-technology-stack)
5. [Service-by-Service Implementation](#5-service-by-service-implementation)
6. [Tool Implementation Details](#6-tool-implementation-details)
7. [Security and Sandboxing](#7-security-and-sandboxing)
8. [Inter-Service Communication](#8-inter-service-communication)

## 1. Introduction and Architecture Overview

### Project Overview

This guide provides a comprehensive blueprint for building an advanced CLI-based AI coding assistant inspired by OpenCode, utilizing Node.js with TypeScript and Express in a microservices architecture. As a command-line interface (CLI) tool, it allows developers to interact with their local codebase through natural language, performing complex code operations without leaving the terminal. Unlike the original Go-based terminal application or a monolithic MERN approach, this implementation leverages microservices to achieve:

- **Scalability**: Each service can scale independently based on demand
- **Maintainability**: Services are isolated and can be developed/deployed independently
- **Technology Flexibility**: Different services can use different technologies if needed
- **Fault Isolation**: Failures in one service don't bring down the entire system
- **Team Scalability**: Different teams can work on different services
- **Local Codebase Integration**: Seamless interaction with local files and development environment
- **Terminal-First Experience**: Native CLI interface optimized for developer workflow

### Original OpenCode Analysis

OpenCode is a sophisticated terminal-based AI coding assistant built in Go that provides:
- Interactive Terminal UI (TUI) using Bubble Tea
- Support for multiple AI providers (OpenAI, Anthropic, Google, AWS Bedrock, etc.)
- Comprehensive tool ecosystem for file manipulation and code execution
- Session management with SQLite persistence
- Language Server Protocol (LSP) integration
- Model Context Protocol (MCP) support for external tools
- Auto-compact feature for context window management

### Microservices Architecture Benefits

The microservices approach offers several advantages over monolithic architectures:

1. **Independent Scaling**: The LLM service can scale differently from the file operations service
2. **Technology Diversity**: Use specialized tools for each service (e.g., Rust for performance-critical tools)
3. **Resilience**: Circuit breakers and fallbacks prevent cascading failures
4. **Development Velocity**: Teams can work independently on different services
5. **Deployment Flexibility**: Rolling updates, canary deployments, and A/B testing

## 2. Complete OpenCode Tools List

### 2.1 File System Tools

#### **glob** - Find files by pattern
```typescript
interface GlobParams {
  pattern: string;        // Required: File pattern (e.g., "*.js", "src/**/*.ts")
  path?: string;         // Optional: Starting directory path
}
```

#### **grep** - Search file contents
```typescript
interface GrepParams {
  pattern: string;        // Required: Regex or literal text
  path?: string;         // Optional: Directory or file to search
  include?: string;      // Optional: File patterns to include
  literal_text?: boolean; // Optional: Treat pattern as literal
}
```

#### **ls** - List directory contents
```typescript
interface LsParams {
  path?: string;         // Optional: Directory to list
  ignore?: string[];     // Optional: Patterns to exclude
}
```

#### **view** - View file contents
```typescript
interface ViewParams {
  file_path: string;     // Required: File to view
  offset?: number;       // Optional: Starting line
  limit?: number;        // Optional: Lines to display (default 1000)
}
```

#### **write** - Write to files
```typescript
interface WriteParams {
  file_path: string;     // Required: Target file path
  content: string;       // Required: Content to write
}
```

#### **edit** - Edit files
```typescript
interface EditParams {
  file_path: string;     // Required: File to edit
  operations: EditOperation[]; // Required: Edit operations
}

interface EditOperation {
  type: 'replace' | 'insert' | 'delete';
  pattern?: string;      // For replace operations
  line?: number;         // For line-based operations
  content?: string;      // New content
}
```

#### **patch** - Apply patches
```typescript
interface PatchParams {
  file_path: string;     // Required: Target file
  diff: string;          // Required: Unified diff format
}
```

### 2.2 System Tools

#### **bash** - Execute shell commands
```typescript
interface BashParams {
  command: string;       // Required: Shell command
  timeout?: number;      // Optional: Timeout in seconds
}
```

#### **fetch** - HTTP requests
```typescript
interface FetchParams {
  url: string;           // Required: URL to fetch
  format: 'json' | 'text' | 'html'; // Required: Response format
  timeout?: number;      // Optional: Request timeout
}
```

#### **sourcegraph** - Search code repositories
```typescript
interface SourcegraphParams {
  query: string;         // Required: Search query
  count?: number;        // Optional: Number of results
  context_window?: number; // Optional: Context lines
  timeout?: number;      // Optional: Search timeout
}
```

#### **agent** - Run sub-tasks
```typescript
interface AgentParams {
  prompt: string;        // Required: Task description
}
```

#### **diagnostics** - Code analysis
```typescript
interface DiagnosticsParams {
  file_path?: string;    // Optional: Specific file
}
```

### 2.3 External Tool Integration

#### **MCP Tools** - Model Context Protocol
- Dynamically loaded from MCP servers
- Support for stdio and SSE communication
- Custom business logic integration

#### **LSP Integration** - Language Server Protocol
- Real-time code diagnostics
- Multi-language support
- Code intelligence features

## 3. Microservices Architecture Design

### 3.1 Service Decomposition

```
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway                              │
│                    (Kong / Nginx / Express Gateway)              │
└─────────────┬───────────────────────────────────┬──────────────┘
              │                                   │
    ┌─────────▼─────────┐               ┌────────▼────────┐
    │   Auth Service    │               │  WebSocket Hub  │
    │  (JWT/OAuth2)     │               │   (Socket.io)   │
    └───────────────────┘               └─────────────────┘
              │                                   │
    ┌─────────▼─────────────────────────────────▼──────────┐
    │                    Message Broker                      │
    │              (RabbitMQ / Kafka / NATS)               │
    └────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┘
         │      │      │      │      │      │      │
    ┌────▼──┐ ┌▼────┐ ┌▼────┐ ┌▼────┐ ┌▼────┐ ┌▼────┐ ┌▼────┐
    │ Chat  │ │LLM  │ │File │ │Tool │ │Sess │ │Perm │ │LSP  │
    │Service│ │Svc  │ │Svc  │ │Exec │ │Mgmt │ │Svc  │ │Svc  │
    └───┬───┘ └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘
        │        │       │       │       │       │       │
    ┌───▼────────▼───────▼───────▼───────▼───────▼───────▼───┐
    │                     Data Layer                          │
    │  MongoDB (Sessions)  │  Redis (Cache)  │  S3 (Files)  │
    └─────────────────────────────────────────────────────────┘
```

### 3.2 Service Definitions

#### 1. **API Gateway Service**
- Routes requests to appropriate microservices
- Handles rate limiting and authentication
- SSL termination and request transformation

#### 2. **Authentication Service**
- JWT token generation and validation
- OAuth2 integration for third-party auth
- User management and API key handling

#### 3. **Chat Service**
- Manages conversation flow
- Orchestrates tool calls
- Handles message streaming

#### 4. **LLM Service**
- Interfaces with multiple AI providers
- Manages model selection and fallbacks
- Token counting and context management

#### 5. **File Operations Service**
- Implements all file system tools
- Sandboxed file access
- Version control integration

#### 6. **Tool Execution Service**
- Secure code execution environment
- Tool permission management
- Resource limitation and monitoring

#### 7. **Session Management Service**
- Conversation persistence
- Session branching and summarization
- User preference storage

#### 8. **Permission Service**
- Fine-grained access control
- Tool usage authorization
- Audit logging

#### 9. **LSP Service**
- Language server protocol proxy
- Code diagnostics aggregation
- Multi-language support

#### 10. **WebSocket Hub**
- Real-time message streaming
- Presence management
- Connection pooling

## 4. Core Technology Stack

### 4.1 Technology Choices

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Runtime** | Node.js 20 LTS + TypeScript 5.x | Type safety, modern features |
| **Web Framework** | Express | Mature, extensive middleware ecosystem |
| **API Gateway** | Express Gateway or Kong | Plugin ecosystem, observability |
| **Message Broker** | NATS JetStream | Lightweight, high performance |
| **Database** | MongoDB | Flexible schemas for AI data |
| **Cache** | Redis | Session storage, pub/sub |
| **Container Runtime** | Docker | Containerization standard |
| **Service Mesh** | Optional (Istio/Linkerd) | Traffic management, security |
| **AI SDKs** | Vercel AI SDK, LangChain.js | Unified LLM interface |

### 4.2 CLI Interface Components

The CLI-based local codebase agent architecture includes the following essential components:

#### Command Line Interface (CLI)
- **Commander.js**: Handles command-line arguments and options
- **Chalk**: Terminal text styling and colors
- **Inquirer**: Interactive prompts and user input handling
- **Terminal Kit**: Advanced terminal features and keyboard input
- **Winston**: Logging for CLI operations

#### Local Codebase Interaction
- **Chokidar**: File system watching for real-time changes
- **Execa**: Process execution with better error handling
- **Node-Pty**: Terminal emulation for interactive processes
- **Fast-Glob**: High-performance file pattern matching
- **Memfs**: In-memory file system for sandboxed operations

#### CLI-Specific Features
- **Progress Bar**: Real-time operation feedback
- **Syntax Highlighting**: Code display with highlighting
- **Local Configuration**: Per-project settings in `.opencode` files
- **Shell Integration**: Hooks for bash/zsh integration
- **Context Awareness**: Intelligent path and project recognition

### 4.3 Shared Libraries

Create shared TypeScript packages for common functionality:

```typescript
// @opencode/shared-types
export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: ToolResult;
}

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  metadata?: any;
}

// @opencode/shared-utils
export class CircuitBreaker { /* ... */ }
export class RetryPolicy { /* ... */ }
export class TokenCounter { /* ... */ }
```

## 5. Service-by-Service Implementation

### 5.1 API Gateway Configuration

```typescript
// gateway/src/index.ts
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import cors from 'cors';
import { authenticateRequest } from './middleware/auth';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);

// Service routes
const services = [
  {
    path: '/api/auth',
    target: 'http://auth-service:3000',
    changeOrigin: true
  },
  {
    path: '/api/chat',
    target: 'http://chat-service:3001',
    changeOrigin: true,
    middleware: [authenticateRequest]
  },
  {
    path: '/api/llm',
    target: 'http://llm-service:3002',
    changeOrigin: true,
    middleware: [authenticateRequest]
  },
  {
    path: '/api/files',
    target: 'http://file-service:3003',
    changeOrigin: true,
    middleware: [authenticateRequest]
  },
  {
    path: '/api/tools',
    target: 'http://tool-execution-service:3004',
    changeOrigin: true,
    middleware: [authenticateRequest]
  },
  {
    path: '/api/sessions',
    target: 'http://session-service:3005',
    changeOrigin: true,
    middleware: [authenticateRequest]
  }
];

// Apply proxy middleware
services.forEach(service => {
  const middleware = service.middleware || [];
  app.use(
    service.path,
    ...middleware,
    createProxyMiddleware({
      target: service.target,
      changeOrigin: service.changeOrigin,
      pathRewrite: {
        [`^${service.path}`]: ''
      }
    })
  );
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
});
```

### 5.2 Authentication Service

```typescript
// auth-service/src/index.ts
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { body, validationResult } from 'express-validator';

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

interface LoginBody {
  email: string;
  password: string;
}

interface RegisterBody extends LoginBody {
  name: string;
}

// Register endpoint
app.post('/register', 
  body('email').isEmail(),
  body('password').isLength({ min: 8 }),
  body('name').notEmpty(),
  async (req: express.Request<{}, {}, RegisterBody>, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { email, password, name } = req.body;
    
    try {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ error: 'User already exists' });
      }
      
      const passwordHash = await bcrypt.hash(password, 10);
      
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name
        }
      });
      
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );
      
      res.status(201).json({
        token,
        user: { id: user.id, email: user.email, name: user.name }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Login endpoint
app.post('/login',
  body('email').isEmail(),
  body('password').notEmpty(),
  async (req: express.Request<{}, {}, LoginBody>, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { email, password } = req.body;
    
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !await bcrypt.compare(password, user.passwordHash)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      );
      
      res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Verify token endpoint
app.post('/verify', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ valid: false });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    res.json({ valid: true, userId: decoded.id });
  } catch (error) {
    res.status(401).json({ valid: false });
  }
});

// API Key validation endpoint
app.post('/validate-api-key', async (req, res) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({ valid: false });
  }
  
  try {
    const keyData = await prisma.apiKey.findUnique({
      where: { key: apiKey }
    });
    
    if (!keyData || keyData.expiresAt < new Date()) {
      return res.status(401).json({ valid: false });
    }
    
    res.json({
      valid: true,
      userId: keyData.userId,
      scopes: keyData.scopes
    });
  } catch (error) {
    console.error('API key validation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Auth service listening on port ${PORT}`);
});
```

### 5.3 Chat Service (Orchestrator)

```typescript
// chat-service/src/index.ts
import express from 'express';
import { EventEmitter } from 'events';
import { NatsConnection, connect } from 'nats';
import { ChatController } from './controllers/ChatController';
import { MessageBroker } from './services/MessageBroker';
import { authenticateRequest } from './middleware/auth';

const app = express();
app.use(express.json());

const events = new EventEmitter();

// Initialize NATS connection and services
let broker: MessageBroker;
let chatController: ChatController;

async function initialize() {
  const nc = await connect({ servers: process.env.NATS_URL });
  broker = new MessageBroker(nc);
  chatController = new ChatController(broker, events);
}

initialize().catch(console.error);

// Chat endpoints
app.post('/message', authenticateRequest, async (req, res) => {
  const { sessionId, message } = req.body;
  const userId = (req as any).user.id;
  
  try {
    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    
    // Process message and stream response
    await chatController.processMessage({
      userId,
      sessionId,
      message,
      stream: (chunk: string) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      },
      onToolCall: async (tool: any) => {
        res.write(`data: ${JSON.stringify({ type: 'tool', tool })}\n\n`);
      }
    });
    
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get conversation history
app.get('/sessions/:sessionId/messages', authenticateRequest, async (req, res) => {
  const { sessionId } = req.params;
  const userId = (req as any).user.id;
  
  try {
    // Verify user has access to session
    const hasAccess = await broker.request('permissions.check-session', {
      userId,
      sessionId
    });
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const messages = await broker.request('sessions.get-messages', {
      sessionId
    });
    
    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Chat service listening on port ${PORT}`);
});

// ChatController implementation
export class ChatController {
  constructor(
    private broker: MessageBroker,
    private events: EventEmitter
  ) {}
  
  async processMessage(params: ProcessMessageParams) {
    // Save user message
    await this.broker.publish('messages.save', {
      sessionId: params.sessionId,
      role: 'user',
      content: params.message
    });
    
    // Get conversation history
    const history = await this.broker.request('sessions.get-messages', {
      sessionId: params.sessionId
    });
    
    // Request LLM completion
    const llmStream = await this.broker.requestStream('llm.complete', {
      messages: history,
      model: 'gpt-4',
      tools: await this.getAvailableTools(params.userId)
    });
    
    let fullResponse = '';
    
    for await (const chunk of llmStream) {
      if (chunk.type === 'text') {
        fullResponse += chunk.content;
        params.stream(chunk.content);
      } else if (chunk.type === 'tool_call') {
        const result = await this.executeToolCall(chunk.tool, params.userId);
        params.onToolCall({ ...chunk.tool, result });
        
        // Continue conversation with tool result
        await this.broker.publish('llm.continue', {
          toolCallId: chunk.tool.id,
          result
        });
      }
    }
    
    // Save assistant response
    await this.broker.publish('messages.save', {
      sessionId: params.sessionId,
      role: 'assistant',
      content: fullResponse
    });
  }
  
  private async executeToolCall(tool: ToolCall, userId: string) {
    // Check permissions
    const hasPermission = await this.broker.request('permissions.check', {
      userId,
      tool: tool.name,
      params: tool.arguments
    });
    
    if (!hasPermission) {
      throw new Error(`Permission denied for tool: ${tool.name}`);
    }
    
    // Execute tool via appropriate service
    return await this.broker.request(`tools.${tool.name}`, tool.arguments);
  }
  
  private async getAvailableTools(userId: string) {
    return await this.broker.request('tools.list', { userId });
  }
}
```

### 5.4 LLM Service

```typescript
// llm-service/src/index.ts
import express from 'express';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { z } from 'zod';
import { ToolRegistry } from './tools/ToolRegistry';
import { MessageBroker } from './services/MessageBroker';

const app = express();
app.use(express.json());

export class LLMService {
  private providers: Map<string, any> = new Map();
  private toolRegistry: ToolRegistry;
  private broker: MessageBroker;
  
  constructor(broker: MessageBroker) {
    this.broker = broker;
    
    // Initialize providers
    this.providers.set('openai', createOpenAI({
      apiKey: process.env.OPENAI_API_KEY
    }));
    
    this.providers.set('anthropic', createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    }));
    
    this.toolRegistry = new ToolRegistry();
    this.registerTools();
    this.setupBrokerHandlers();
  }
  
  private registerTools() {
    // Register all available tools with schemas
    this.toolRegistry.register({
      name: 'glob',
      description: 'Find files matching a pattern',
      parameters: z.object({
        pattern: z.string().describe('File pattern like *.js'),
        path: z.string().optional().describe('Starting directory')
      }),
      execute: async (params) => {
        // Forward to file service
        return await this.broker.request('file.glob', params);
      }
    });
    
    this.toolRegistry.register({
      name: 'grep',
      description: 'Search for text patterns in files',
      parameters: z.object({
        pattern: z.string().describe('Search pattern'),
        path: z.string().optional().describe('Directory or file to search'),
        include: z.string().optional().describe('File patterns to include'),
        literal_text: z.boolean().optional().describe('Treat as literal text')
      }),
      execute: async (params) => {
        return await this.broker.request('file.grep', params);
      }
    });
    
    // Register other tools...
  }
  
  private setupBrokerHandlers() {
    // Handle completion requests
    this.broker.subscribe('llm.complete', async (data) => {
      const { messages, model, tools, requestId } = data;
      
      try {
        await this.streamCompletion({
          provider: 'openai',
          model: model || 'gpt-4',
          messages,
          tools,
          requestId
        });
      } catch (error) {
        console.error('LLM completion error:', error);
        await this.broker.publish('llm.error', {
          requestId,
          error: error.message
        });
      }
    });
    
    // Handle tool list requests
    this.broker.subscribe('tools.list', async (data) => {
      const tools = this.toolRegistry.getToolDefinitions();
      return tools;
    });
  }
  
  async streamCompletion(params: CompletionParams) {
    const provider = this.providers.get(params.provider || 'openai');
    const model = provider(params.model || 'gpt-4');
    
    const result = await streamText({
      model,
      messages: params.messages,
      tools: this.toolRegistry.getTools(),
      maxTokens: params.maxTokens || 4096,
      temperature: params.temperature || 0.7,
      onChunk: async ({ chunk }) => {
        // Stream chunks back via message broker
        await this.broker.publish('llm.chunk', {
          requestId: params.requestId,
          chunk
        });
      }
    });
    
    return result;
  }
}

// Initialize service
async function startService() {
  const nc = await connect({ servers: process.env.NATS_URL });
  const broker = new MessageBroker(nc);
  const llmService = new LLMService(broker);
  
  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => {
    console.log(`LLM service listening on port ${PORT}`);
  });
}

startService().catch(console.error);

// Tool Registry implementation
export class ToolRegistry {
  private tools = new Map<string, Tool>();
  
  register(tool: Tool) {
    this.tools.set(tool.name, tool);
  }
  
  getTools() {
    return Object.fromEntries(
      Array.from(this.tools.entries()).map(([name, tool]) => [
        name,
        {
          description: tool.description,
          parameters: tool.parameters,
          execute: tool.execute
        }
      ])
    );
  }
  
  getToolDefinitions() {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters.shape
    }));
  }
}
```

### 5.5 File Operations Service

```typescript
// file-service/src/index.ts
import express from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import { glob } from 'glob';
import { minimatch } from 'minimatch';
import { SecurityManager } from './security/SecurityManager';
import { MessageBroker } from './services/MessageBroker';

const app = express();
app.use(express.json());

export class FileService {
  private security: SecurityManager;
  private broker: MessageBroker;
  
  constructor(broker: MessageBroker) {
    this.broker = broker;
    this.security = new SecurityManager({
      basePath: process.env.WORKSPACE_BASE_PATH!,
      allowedPatterns: process.env.ALLOWED_PATTERNS?.split(',') || ['**/*'],
      deniedPatterns: process.env.DENIED_PATTERNS?.split(',') || [
        '**/node_modules/**',
        '**/.git/**',
        '**/secrets/**'
      ]
    });
    
    this.setupBrokerHandlers();
  }
  
  private setupBrokerHandlers() {
    this.broker.subscribe('file.glob', async (params) => {
      return await this.glob(params);
    });
    
    this.broker.subscribe('file.grep', async (params) => {
      return await this.grep(params);
    });
    
    this.broker.subscribe('file.ls', async (params) => {
      return await this.ls(params);
    });
    
    this.broker.subscribe('file.view', async (params) => {
      return await this.view(params);
    });
    
    this.broker.subscribe('file.write', async (params) => {
      return await this.write(params);
    });
  }
  
  async glob(params: GlobParams): Promise<string[]> {
    const safePath = this.security.validatePath(params.path || '.');
    
    const files = await glob(params.pattern, {
      cwd: safePath,
      ignore: this.security.deniedPatterns,
      nodir: true
    });
    
    return files.filter(file => this.security.isAllowed(file));
  }
  
  async grep(params: GrepParams): Promise<GrepResult[]> {
    const safePath = this.security.validatePath(params.path || '.');
    const regex = params.literal_text 
      ? new RegExp(this.escapeRegex(params.pattern), 'g')
      : new RegExp(params.pattern, 'g');
    
    const results: GrepResult[] = [];
    const files = await this.findFiles(safePath, params.include);
    
    for (const file of files) {
      const content = await fs.readFile(file, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        if (regex.test(line)) {
          results.push({
            file: path.relative(safePath, file),
            line: index + 1,
            content: line,
            matches: [...line.matchAll(regex)].map(m => ({
              start: m.index!,
              end: m.index! + m[0].length,
              text: m[0]
            }))
          });
        }
      });
    }
    
    return results;
  }
  
  async ls(params: LsParams): Promise<FileInfo[]> {
    const safePath = this.security.validatePath(params.path || '.');
    const entries = await fs.readdir(safePath, { withFileTypes: true });
    
    const results: FileInfo[] = [];
    
    for (const entry of entries) {
      const fullPath = path.join(safePath, entry.name);
      
      // Check ignore patterns
      if (params.ignore?.some(pattern => minimatch(entry.name, pattern))) {
        continue;
      }
      
      const stats = await fs.stat(fullPath);
      
      results.push({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        modified: stats.mtime,
        permissions: stats.mode
      });
    }
    
    return results;
  }
  
  async view(params: ViewParams): Promise<ViewResult> {
    const safePath = this.security.validatePath(params.file_path);
    
    const content = await fs.readFile(safePath, 'utf-8');
    const lines = content.split('\n');
    
    const offset = params.offset || 0;
    const limit = params.limit || 1000;
    
    return {
      content: lines.slice(offset, offset + limit).join('\n'),
      totalLines: lines.length,
      offset,
      limit,
      hasMore: offset + limit < lines.length
    };
  }
  
  async write(params: WriteParams): Promise<WriteResult> {
    const safePath = this.security.validatePath(params.file_path);
    
    // Check if file exists for proper operation type
    let exists = false;
    try {
      await fs.access(safePath);
      exists = true;
    } catch {}
    
    // Create backup if file exists
    if (exists && process.env.ENABLE_BACKUPS === 'true') {
      const backupPath = `${safePath}.backup.${Date.now()}`;
      await fs.copyFile(safePath, backupPath);
    }
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(safePath), { recursive: true });
    
    // Write file
    await fs.writeFile(safePath, params.content, 'utf-8');
    
    return {
      operation: exists ? 'modified' : 'created',
      path: params.file_path,
      size: Buffer.byteLength(params.content, 'utf-8')
    };
  }
  
  private async findFiles(dir: string, include?: string): Promise<string[]> {
    const files: string[] = [];
    
    async function walk(currentDir: string) {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (!include || minimatch(entry.name, include)) {
          files.push(fullPath);
        }
      }
    }
    
    await walk(dir);
    return files;
  }
  
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Initialize service
async function startService() {
  const nc = await connect({ servers: process.env.NATS_URL });
  const broker = new MessageBroker(nc);
  const fileService = new FileService(broker);
  
  const PORT = process.env.PORT || 3003;
  app.listen(PORT, () => {
    console.log(`File service listening on port ${PORT}`);
  });
}

startService().catch(console.error);

// Security Manager
export class SecurityManager {
  constructor(private config: SecurityConfig) {}
  
  validatePath(requestedPath: string): string {
    const resolved = path.resolve(this.config.basePath, requestedPath);
    
    // Prevent directory traversal
    if (!resolved.startsWith(this.config.basePath)) {
      throw new Error('Access denied: Path outside workspace');
    }
    
    // Check against denied patterns
    for (const pattern of this.config.deniedPatterns) {
      if (minimatch(resolved, pattern)) {
        throw new Error(`Access denied: Path matches denied pattern ${pattern}`);
      }
    }
    
    return resolved;
  }
  
  isAllowed(filePath: string): boolean {
    for (const pattern of this.config.allowedPatterns) {
      if (minimatch(filePath, pattern)) {
        return true;
      }
    }
    return false;
  }
}
```

### 5.6 Tool Execution Service

```typescript
// tool-execution-service/src/index.ts
import express from 'express';
import { VM } from 'vm2';
import { spawn } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import { RateLimiter } from './utils/RateLimiter';
import { ResourceMonitor } from './utils/ResourceMonitor';
import { MessageBroker } from './services/MessageBroker';

const app = express();
app.use(express.json());

export class ToolExecutionService {
  private rateLimiter: RateLimiter;
  private resourceMonitor: ResourceMonitor;
  private broker: MessageBroker;
  
  constructor(broker: MessageBroker) {
    this.broker = broker;
    this.rateLimiter = new RateLimiter({
      bash: { requests: 10, window: 60000 }, // 10 per minute
      fetch: { requests: 50, window: 60000 }, // 50 per minute
      codeExecutor: { requests: 5, window: 60000 } // 5 per minute
    });
    
    this.resourceMonitor = new ResourceMonitor({
      maxCpu: 80, // 80% CPU
      maxMemory: 512 * 1024 * 1024, // 512MB
      maxExecutionTime: 30000 // 30 seconds
    });
    
    this.setupBrokerHandlers();
  }
  
  private setupBrokerHandlers() {
    this.broker.subscribe('tools.bash', async (params) => {
      const { command, timeout, userId } = params;
      return await this.executeBash({ command, timeout }, userId);
    });
    
    this.broker.subscribe('tools.fetch', async (params) => {
      const { url, format, timeout, userId } = params;
      return await this.executeFetch({ url, format, timeout }, userId);
    });
    
    this.broker.subscribe('tools.sourcegraph', async (params) => {
      return await this.searchSourcegraph(params);
    });
  }
  
  async executeBash(params: BashParams, userId: string): Promise<BashResult> {
    await this.rateLimiter.checkLimit('bash', userId);
    
    // Security checks
    const dangerousPatterns = [
      /rm\s+-rf\s+\//,
      /:\(\)\s*{\s*:\|:\s*&\s*}\s*;/, // Fork bomb
      /dd\s+if=\/dev\/zero/,
      /mkfs/,
      /> \/dev\/s[d|h]a/
    ];
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(params.command)) {
        throw new Error('Command contains potentially dangerous operations');
      }
    }
    
    return new Promise((resolve, reject) => {
      const child = spawn('bash', ['-c', params.command], {
        timeout: (params.timeout || 30) * 1000,
        env: {
          ...process.env,
          PATH: '/usr/local/bin:/usr/bin:/bin' // Restricted PATH
        },
        cwd: process.env.SANDBOX_PATH
      });
      
      let stdout = '';
      let stderr = '';
      
      // Monitor resource usage
      const monitor = this.resourceMonitor.monitor(child.pid!);
      
      child.stdout.on('data', (data) => {
        stdout += data.toString();
        if (stdout.length > 1024 * 1024) { // 1MB limit
          child.kill();
          reject(new Error('Output size limit exceeded'));
        }
      });
      
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      child.on('exit', (code) => {
        monitor.stop();
        resolve({
          stdout,
          stderr,
          exitCode: code || 0,
          executionTime: monitor.getExecutionTime()
        });
      });
      
      child.on('error', (err) => {
        monitor.stop();
        reject(err);
      });
    });
  }
  
  async executeFetch(params: FetchParams, userId: string): Promise<FetchResult> {
    await this.rateLimiter.checkLimit('fetch', userId);
    
    // URL validation
    const url = new URL(params.url);
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
    
    if (blockedHosts.includes(url.hostname)) {
      throw new Error('Access to local addresses is not allowed');
    }
    
    try {
      const response = await axios({
        method: 'GET',
        url: params.url,
        timeout: (params.timeout || 30) * 1000,
        maxContentLength: 10 * 1024 * 1024, // 10MB
        responseType: params.format === 'json' ? 'json' : 'text',
        headers: {
          'User-Agent': 'OpenCode-Agent/1.0'
        }
      });
      
      return {
        data: params.format === 'json' 
          ? JSON.stringify(response.data, null, 2)
          : response.data,
        statusCode: response.status,
        headers: response.headers
      };
    } catch (error: any) {
      throw new Error(`Fetch failed: ${error.message}`);
    }
  }
  
  async searchSourcegraph(params: SourcegraphParams): Promise<any> {
    const query = encodeURIComponent(params.query);
    const count = params.count || 10;
    
    try {
      const response = await axios.get(
        `https://sourcegraph.com/api/search/stream?q=${query}&display=${count}`,
        {
          timeout: (params.timeout || 30) * 1000,
          headers: {
            'Accept': 'text/event-stream'
          }
        }
      );
      
      // Parse streaming response
      const results = this.parseSourcegraphResponse(response.data);
      
      return {
        results,
        count: results.length,
        query: params.query
      };
    } catch (error: any) {
      throw new Error(`Sourcegraph search failed: ${error.message}`);
    }
  }
  
  async executeJavaScript(code: string, userId: string): Promise<any> {
    await this.rateLimiter.checkLimit('codeExecutor', userId);
    
    const vm = new VM({
      timeout: 5000,
      sandbox: {
        console: {
          log: (...args: any[]) => {
            // Capture console output
            this.broker.publish('tool.output', {
              userId,
              type: 'console',
              data: args
            });
          }
        },
        // Limited globals
        Math,
        Date,
        JSON,
        Array,
        Object,
        String,
        Number,
        Boolean
      }
    });
    
    try {
      const result = vm.run(code);
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
  
  private parseSourcegraphResponse(data: string): any[] {
    // Parse SSE format response
    const results: any[] = [];
    const lines = data.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.type === 'match') {
            results.push(json);
          }
        } catch {}
      }
    }
    
    return results;
  }
}

// Initialize service
async function startService() {
  const nc = await connect({ servers: process.env.NATS_URL });
  const broker = new MessageBroker(nc);
  const toolService = new ToolExecutionService(broker);
  
  const PORT = process.env.PORT || 3004;
  app.listen(PORT, () => {
    console.log(`Tool execution service listening on port ${PORT}`);
  });
}

startService().catch(console.error);

// Rate Limiter
export class RateLimiter {
  private limits: Map<string, Map<string, number[]>> = new Map();
  
  constructor(private config: Record<string, { requests: number; window: number }>) {}
  
  async checkLimit(tool: string, userId: string): Promise<void> {
    const limit = this.config[tool];
    if (!limit) return;
    
    const key = `${tool}:${userId}`;
    const now = Date.now();
    
    if (!this.limits.has(key)) {
      this.limits.set(key, new Map());
    }
    
    const userLimits = this.limits.get(key)!;
    const toolLimits = userLimits.get(tool) || [];
    
    // Remove old entries
    const validLimits = toolLimits.filter(time => now - time < limit.window);
    
    if (validLimits.length >= limit.requests) {
      throw new Error(`Rate limit exceeded for ${tool}`);
    }
    
    validLimits.push(now);
    userLimits.set(tool, validLimits);
  }
}

// Resource Monitor
export class ResourceMonitor {
  private monitors: Map<number, any> = new Map();
  
  constructor(private config: ResourceConfig) {}
  
  monitor(pid: number) {
    const startTime = Date.now();
    const interval = setInterval(() => {
      // Check CPU and memory usage
      // Implementation depends on OS-specific tools
    }, 1000);
    
    const monitor = {
      stop: () => {
        clearInterval(interval);
        this.monitors.delete(pid);
      },
      getExecutionTime: () => Date.now() - startTime
    };
    
    this.monitors.set(pid, monitor);
    return monitor;
  }
}
```

### 5.7 Session Management Service

```typescript
// session-service/src/index.ts
import express from 'express';
import { MongoClient, Db, Collection } from 'mongodb';
import { Redis } from 'ioredis';
import { SessionManager } from './managers/SessionManager';
import { AutoCompactService } from './services/AutoCompactService';
import { MessageBroker } from './services/MessageBroker';

const app = express();
app.use(express.json());

export class SessionService {
  private db: Db;
  private redis: Redis;
  private sessionManager: SessionManager;
  private autoCompact: AutoCompactService;
  private broker: MessageBroker;
  
  constructor(broker: MessageBroker) {
    this.broker = broker;
    this.initializeConnections();
  }
  
  private async initializeConnections() {
    // MongoDB connection
    const client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();
    this.db = client.db('opencode');
    
    // Redis connection
    this.redis = new Redis(process.env.REDIS_URI!);
    
    // Initialize managers
    this.sessionManager = new SessionManager(this.db, this.redis);
    this.autoCompact = new AutoCompactService(this.sessionManager, this.broker);
    
    this.setupBrokerHandlers();
  }
  
  private setupBrokerHandlers() {
    this.broker.subscribe('sessions.create', async (params) => {
      return await this.createSession(params);
    });
    
    this.broker.subscribe('sessions.get-messages', async (params) => {
      return await this.getMessages(params.sessionId, params.limit);
    });
    
    this.broker.subscribe('messages.save', async (params) => {
      return await this.addMessage(params);
    });
    
    this.broker.subscribe('sessions.list', async (params) => {
      return await this.listSessions(params.userId);
    });
  }
  
  async createSession(params: CreateSessionParams): Promise<Session> {
    const session = await this.sessionManager.create({
      userId: params.userId,
      title: params.title || 'New Conversation',
      model: params.model || 'gpt-4',
      systemPrompt: params.systemPrompt
    });
    
    // Cache in Redis for quick access
    await this.redis.setex(
      `session:${session.id}`,
      3600, // 1 hour TTL
      JSON.stringify(session)
    );
    
    return session;
  }
  
  async addMessage(params: AddMessageParams): Promise<Message> {
    const message = await this.sessionManager.addMessage({
      sessionId: params.sessionId,
      role: params.role,
      content: params.content,
      toolCalls: params.toolCalls
    });
    
    // Check if auto-compact needed
    const session = await this.sessionManager.getSession(params.sessionId);
    const tokenCount = await this.countTokens(session);
    
    if (tokenCount > this.getModelLimit(session.model) * 0.9) {
      await this.autoCompact.compactSession(session);
    }
    
    // Invalidate cache
    await this.redis.del(`messages:${params.sessionId}`);
    
    // Publish message event
    await this.broker.publish('session.message', {
      sessionId: params.sessionId,
      message
    });
    
    return message;
  }
  
  async getMessages(sessionId: string, limit?: number): Promise<Message[]> {
    // Try cache first
    const cached = await this.redis.get(`messages:${sessionId}`);
    if (cached && !limit) {
      return JSON.parse(cached);
    }
    
    // Fetch from MongoDB
    const messages = await this.db
      .collection<Message>('messages')
      .find({ sessionId })
      .sort({ timestamp: 1 })
      .limit(limit || 100)
      .toArray();
    
    // Cache for future requests if no limit specified
    if (!limit) {
      await this.redis.setex(
        `messages:${sessionId}`,
        300, // 5 minute TTL
        JSON.stringify(messages)
      );
    }
    
    return messages;
  }
  
  async listSessions(userId: string): Promise<Session[]> {
    return await this.db
      .collection<Session>('sessions')
      .find({ userId })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();
  }
  
  private async countTokens(session: Session): Promise<number> {
    // Use tiktoken or similar for accurate counting
    const messages = await this.getMessages(session.id);
    const content = messages.map(m => m.content).join(' ');
    
    // Simplified token counting (implement proper tokenizer)
    return Math.ceil(content.length / 4);
  }
  
  private getModelLimit(model: string): number {
    const limits: Record<string, number> = {
      'gpt-4': 8192,
      'gpt-4-32k': 32768,
      'claude-3-opus': 200000,
      'claude-3-sonnet': 200000
    };
    return limits[model] || 4096;
  }
}

// Initialize service
async function startService() {
  const nc = await connect({ servers: process.env.NATS_URL });
  const broker = new MessageBroker(nc);
  const sessionService = new SessionService(broker);
  
  const PORT = process.env.PORT || 3005;
  app.listen(PORT, () => {
    console.log(`Session service listening on port ${PORT}`);
  });
}

startService().catch(console.error);

// Auto-compact Service
export class AutoCompactService {
  constructor(
    private sessionManager: SessionManager,
    private broker: MessageBroker
  ) {}
  
  async compactSession(session: Session): Promise<void> {
    const messages = await this.sessionManager.getMessages(session.id);
    
    // Split messages into chunks
    const earlyMessages = messages.slice(0, Math.floor(messages.length * 0.7));
    const recentMessages = messages.slice(Math.floor(messages.length * 0.7));
    
    // Summarize early messages
    const summary = await this.broker.request('llm.summarize', {
      messages: earlyMessages,
      instructions: 'Summarize the key points and context from this conversation'
    });
    
    // Create new compacted session
    const compactedSession = await this.sessionManager.create({
      userId: session.userId,
      title: `${session.title} (Compacted)`,
      parentSessionId: session.id,
      model: session.model,
      systemPrompt: session.systemPrompt
    });
    
    // Add summary as first message
    await this.sessionManager.addMessage({
      sessionId: compactedSession.id,
      role: 'system',
      content: `Previous conversation summary: ${summary}`
    });
    
    // Add recent messages
    for (const message of recentMessages) {
      await this.sessionManager.addMessage({
        sessionId: compactedSession.id,
        role: message.role,
        content: message.content,
        toolCalls: message.toolCalls
      });
    }
    
    // Update references
    await this.sessionManager.updateSession(session.id, {
      compactedToSessionId: compactedSession.id
    });
  }
}
```

### 5.8 WebSocket Hub Service

```typescript
// websocket-hub/src/index.ts
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';
import { MessageBroker } from './services/MessageBroker';
import { connect } from 'nats';

export class WebSocketHub {
  private io: Server;
  private pubClient: Redis;
  private subClient: Redis;
  private broker: MessageBroker;
  
  constructor() {
    this.initialize();
  }
  
  private async initialize() {
    // Create Socket.IO server
    this.io = new Server({
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
        credentials: true
      }
    });
    
    // Setup Redis adapter for scaling
    this.pubClient = new Redis(process.env.REDIS_URI!);
    this.subClient = this.pubClient.duplicate();
    this.io.adapter(createAdapter(this.pubClient, this.subClient));
    
    // Setup NATS broker
    const nc = await connect({ servers: process.env.NATS_URL });
    this.broker = new MessageBroker(nc);
    
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        socket.data.userId = decoded.id;
        socket.data.permissions = decoded.permissions;
        next();
      } catch (err) {
        next(new Error('Authentication failed'));
      }
    });
    
    // Connection handling
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.data.userId} connected`);
      
      // Join user's personal room
      socket.join(`user:${socket.data.userId}`);
      
      // Handle session subscriptions
      socket.on('subscribe:session', async (sessionId: string) => {
        // Verify user has access to session
        const hasAccess = await this.verifySessionAccess(
          socket.data.userId,
          sessionId
        );
        
        if (hasAccess) {
          socket.join(`session:${sessionId}`);
          socket.emit('subscribed', { sessionId });
        } else {
          socket.emit('error', { message: 'Access denied to session' });
        }
      });
      
      // Handle chat messages
      socket.on('send:message', async (data: any) => {
        // Forward to chat service via message broker
        await this.broker.publish('chat.message', {
          userId: socket.data.userId,
          sessionId: data.sessionId,
          content: data.content,
          socketId: socket.id
        });
      });
      
      // Handle tool permission responses
      socket.on('tool:permission:response', async (data: any) => {
        await this.broker.publish('tool.permission.response', {
          userId: socket.data.userId,
          toolId: data.toolId,
          approved: data.approved
        });
      });
      
      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.data.userId} disconnected`);
      });
    });
    
    // Subscribe to broker events
    this.subscribeToEvents();
    
    // Start server
    const PORT = process.env.PORT || 3006;
    this.io.listen(PORT);
    console.log(`WebSocket hub listening on port ${PORT}`);
  }
  
  private async subscribeToEvents() {
    // Stream message chunks to clients
    await this.broker.subscribe('websocket.stream', async (data: any) => {
      this.io.to(`session:${data.sessionId}`).emit('message:chunk', {
        content: data.content,
        messageId: data.messageId
      });
    });
    
    // Broadcast complete messages
    await this.broker.subscribe('websocket.message', async (data: any) => {
      this.io.to(`session:${data.sessionId}`).emit('message:complete', {
        message: data.message
      });
    });
    
    // Tool execution events
    await this.broker.subscribe('websocket.tool', async (data: any) => {
      this.io.to(`session:${data.sessionId}`).emit('tool:event', {
        type: data.type, // 'started', 'output', 'completed', 'error'
        tool: data.tool,
        data: data.data
      });
    });
    
    // Tool permission requests
    await this.broker.subscribe('websocket.tool.permission', async (data: any) => {
      this.io.to(`user:${data.userId}`).emit('tool:permission:request', {
        toolId: data.toolId,
        tool: data.tool,
        params: data.params
      });
    });
  }
  
  private async verifySessionAccess(
    userId: string,
    sessionId: string
  ): Promise<boolean> {
    const result = await this.broker.request('permissions.check-session', {
      userId,
      sessionId
    });
    return result.hasAccess;
  }
}

// Initialize the hub
new WebSocketHub();
```

## 6. Tool Implementation Details

### 6.1 Base Tool Interface

```typescript
// shared/src/tools/base.ts
import { z } from 'zod';

export interface Tool<TParams = any, TResult = any> {
  name: string;
  description: string;
  category: 'filesystem' | 'system' | 'code' | 'external';
  parameters: z.ZodSchema<TParams>;
  permissions: {
    requiresApproval: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    scopes: string[];
  };
  execute(params: TParams, context: ToolContext): Promise<TResult>;
}

export interface ToolContext {
  userId: string;
  sessionId: string;
  workspacePath: string;
  permissions: string[];
  broker: MessageBroker;
  logger: Logger;
}

export abstract class BaseTool<TParams = any, TResult = any> 
  implements Tool<TParams, TResult> {
  
  abstract name: string;
  abstract description: string;
  abstract category: Tool['category'];
  abstract parameters: z.ZodSchema<TParams>;
  abstract permissions: Tool['permissions'];
  
  async execute(params: TParams, context: ToolContext): Promise<TResult> {
    // Validate parameters
    const validated = this.parameters.parse(params);
    
    // Log execution
    context.logger.info(`Executing tool ${this.name}`, {
      tool: this.name,
      params: validated,
      userId: context.userId
    });
    
    // Execute with error handling
    try {
      const result = await this.doExecute(validated, context);
      
      // Log success
      context.logger.info(`Tool ${this.name} completed successfully`, {
        tool: this.name,
        userId: context.userId
      });
      
      return result;
    } catch (error) {
      // Log error
      context.logger.error(`Tool ${this.name} failed`, {
        tool: this.name,
        error: error.message,
        userId: context.userId
      });
      
      throw error;
    }
  }
  
  protected abstract doExecute(
    params: TParams,
    context: ToolContext
  ): Promise<TResult>;
}
```

### 6.2 Advanced File System Tools

```typescript
// file-service/src/tools/advanced/EditTool.ts
import { z } from 'zod';
import { promises as fs } from 'fs';
import * as diff from 'diff';
import { BaseTool } from '@opencode/shared';

const EditParams = z.object({
  file_path: z.string(),
  operations: z.array(z.object({
    type: z.enum(['replace', 'insert', 'delete']),
    pattern: z.string().optional(),
    line: z.number().optional(),
    content: z.string().optional(),
    start_line: z.number().optional(),
    end_line: z.number().optional()
  }))
});

export class EditTool extends BaseTool<z.infer<typeof EditParams>> {
  name = 'edit';
  description = 'Edit files with multiple operations';
  category = 'filesystem' as const;
  parameters = EditParams;
  permissions = {
    requiresApproval: true,
    riskLevel: 'medium' as const,
    scopes: ['workspace:write']
  };
  
  protected async doExecute(params: z.infer<typeof EditParams>, context: ToolContext) {
    const safePath = this.validatePath(params.file_path, context.workspacePath);
    
    // Read current content
    let content = await fs.readFile(safePath, 'utf-8');
    const originalContent = content;
    const lines = content.split('\n');
    
    // Apply operations
    for (const operation of params.operations) {
      switch (operation.type) {
        case 'replace':
          if (operation.pattern && operation.content !== undefined) {
            content = content.replace(
              new RegExp(operation.pattern, 'g'),
              operation.content
            );
          }
          break;
          
        case 'insert':
          if (operation.line !== undefined && operation.content) {
            lines.splice(operation.line, 0, operation.content);
            content = lines.join('\n');
          }
          break;
          
        case 'delete':
          if (operation.start_line !== undefined && operation.end_line !== undefined) {
            lines.splice(
              operation.start_line,
              operation.end_line - operation.start_line + 1
            );
            content = lines.join('\n');
          }
          break;
      }
    }
    
    // Generate diff
    const patch = diff.createPatch(
      params.file_path,
      originalContent,
      content,
      'original',
      'modified'
    );
    
    // Write changes
    await fs.writeFile(safePath, content, 'utf-8');
    
    return {
      success: true,
      file_path: params.file_path,
      operations_applied: params.operations.length,
      diff: patch
    };
  }
  
  private validatePath(filePath: string, workspacePath: string): string {
    const path = require('path');
    const resolved = path.resolve(workspacePath, filePath);
    
    if (!resolved.startsWith(workspacePath)) {
      throw new Error('Access denied: Path outside workspace');
    }
    
    return resolved;
  }
}

// Patch Tool
export class PatchTool extends BaseTool {
  name = 'patch';
  description = 'Apply unified diff patches to files';
  category = 'filesystem' as const;
  parameters = z.object({
    file_path: z.string(),
    diff: z.string()
  });
  permissions = {
    requiresApproval: true,
    riskLevel: 'medium' as const,
    scopes: ['workspace:write']
  };
  
  protected async doExecute(params: any, context: ToolContext) {
    const safePath = this.validatePath(params.file_path, context.workspacePath);
    
    // Read current content
    const currentContent = await fs.readFile(safePath, 'utf-8');
    
    // Apply patch
    const patchedContent = diff.applyPatch(currentContent, params.diff);
    
    if (patchedContent === false) {
      throw new Error('Failed to apply patch');
    }
    
    // Write patched content
    await fs.writeFile(safePath, patchedContent, 'utf-8');
    
    return {
      success: true,
      file_path: params.file_path,
      applied: true
    };
  }
}

// Git Tool
import { simpleGit, SimpleGit } from 'simple-git';

export class GitTool extends BaseTool {
  name = 'git';
  description = 'Perform git operations in the workspace';
  category = 'filesystem' as const;
  parameters = z.object({
    operation: z.enum(['status', 'diff', 'log', 'branch', 'checkout']),
    args: z.record(z.any()).optional()
  });
  permissions = {
    requiresApproval: true,
    riskLevel: 'medium' as const,
    scopes: ['workspace:git']
  };
  
  private git: SimpleGit;
  
  constructor() {
    super();
    this.git = simpleGit();
  }
  
  protected async doExecute(params: any, context: ToolContext) {
    // Set working directory
    this.git.cwd(context.workspacePath);
    
    switch (params.operation) {
      case 'status':
        return await this.git.status();
        
      case 'diff':
        const diffArgs = params.args || {};
        return await this.git.diff(diffArgs.files || []);
        
      case 'log':
        const logOptions = params.args || {};
        return await this.git.log({
          maxCount: logOptions.limit || 10,
          file: logOptions.file
        });
        
      case 'branch':
        return await this.git.branch();
        
      case 'checkout':
        if (!params.args?.branch) {
          throw new Error('Branch name required for checkout');
        }
        return await this.git.checkout(params.args.branch);
        
      default:
        throw new Error(`Unknown git operation: ${params.operation}`);
    }
  }
}
```

### 6.3 System Tools Implementation

```typescript
// tool-execution-service/src/tools/AgentTool.ts
import { z } from 'zod';
import { BaseTool } from '@opencode/shared';

export class AgentTool extends BaseTool {
  name = 'agent';
  description = 'Run a sub-agent for complex tasks';
  category = 'system' as const;
  parameters = z.object({
    prompt: z.string().describe('Task description for the sub-agent')
  });
  permissions = {
    requiresApproval: true,
    riskLevel: 'low' as const,
    scopes: ['agent:spawn']
  };
  
  protected async doExecute(params: any, context: ToolContext) {
    // Create a new sub-session
    const subSession = await context.broker.request('sessions.create', {
      userId: context.userId,
      title: `Sub-task: ${params.prompt.slice(0, 50)}...`,
      parentSessionId: context.sessionId
    });
    
    // Execute the sub-agent task
    const result = await context.broker.request('agent.execute', {
      sessionId: subSession.id,
      prompt: params.prompt,
      parentContext: {
        sessionId: context.sessionId,
        workspacePath: context.workspacePath
      }
    });
    
    return {
      success: true,
      sessionId: subSession.id,
      result: result.response,
      toolsUsed: result.toolsUsed
    };
  }
}

// Diagnostics Tool
export class DiagnosticsTool extends BaseTool {
  name = 'diagnostics';
  description = 'Get code diagnostics and linting information';
  category = 'code' as const;
  parameters = z.object({
    file_path: z.string().optional().describe('Specific file to analyze')
  });
  permissions = {
    requiresApproval: false,
    riskLevel: 'low' as const,
    scopes: ['workspace:read']
  };
  
  protected async doExecute(params: any, context: ToolContext) {
    // Request diagnostics from LSP service
    const diagnostics = await context.broker.request('lsp.diagnostics', {
      workspacePath: context.workspacePath,
      filePath: params.file_path
    });
    
    return {
      diagnostics: diagnostics.items,
      summary: {
        errors: diagnostics.items.filter(d => d.severity === 'error').length,
        warnings: diagnostics.items.filter(d => d.severity === 'warning').length,
        info: diagnostics.items.filter(d => d.severity === 'info').length
      }
    };
  }
}
```

### 6.4 External Integration Tools

```typescript
// external-service/src/tools/DatabaseTool.ts
import { z } from 'zod';
import { MongoClient } from 'mongodb';
import { Pool } from 'pg';
import { BaseTool } from '@opencode/shared';

const DatabaseParams = z.object({
  type: z.enum(['mongodb', 'postgresql', 'mysql']),
  operation: z.enum(['query', 'insert', 'update', 'delete']),
  collection: z.string().optional(),
  table: z.string().optional(),
  query: z.any(),
  data: z.any().optional()
});

export class DatabaseTool extends BaseTool<z.infer<typeof DatabaseParams>> {
  name = 'database';
  description = 'Query and manipulate database data';
  category = 'external' as const;
  parameters = DatabaseParams;
  permissions = {
    requiresApproval: true,
    riskLevel: 'high' as const,
    scopes: ['database:read', 'database:write']
  };
  
  private connections: Map<string, any> = new Map();
  
  protected async doExecute(params: z.infer<typeof DatabaseParams>, context: ToolContext) {
    // Get connection configuration for user
    const config = await this.getDbConfig(context.userId, params.type);
    const connection = await this.getConnection(params.type, config);
    
    switch (params.type) {
      case 'mongodb':
        return await this.executeMongoOperation(connection, params);
      case 'postgresql':
        return await this.executePostgresOperation(connection, params);
      default:
        throw new Error(`Unsupported database type: ${params.type}`);
    }
  }
  
  private async executeMongoOperation(client: MongoClient, params: any) {
    const db = client.db();
    const collection = db.collection(params.collection);
    
    switch (params.operation) {
      case 'query':
        return await collection.find(params.query).toArray();
      case 'insert':
        return await collection.insertMany(params.data);
      case 'update':
        return await collection.updateMany(params.query, { $set: params.data });
      case 'delete':
        return await collection.deleteMany(params.query);
    }
  }
  
  private async executePostgresOperation(pool: Pool, params: any) {
    const client = await pool.connect();
    
    try {
      switch (params.operation) {
        case 'query':
          const result = await client.query(params.query);
          return result.rows;
        // Implement other operations...
      }
    } finally {
      client.release();
    }
  }
  
  private async getConnection(type: string, config: any) {
    const key = `${type}:${config.connectionString}`;
    
    if (!this.connections.has(key)) {
      let connection;
      
      switch (type) {
        case 'mongodb':
          connection = new MongoClient(config.connectionString);
          await connection.connect();
          break;
        case 'postgresql':
          connection = new Pool({ connectionString: config.connectionString });
          break;
      }
      
      this.connections.set(key, connection);
    }
    
    return this.connections.get(key);
  }
  
  private async getDbConfig(userId: string, dbType: string) {
    // Fetch user's database configuration
    return await context.broker.request('config.get-db', {
      userId,
      dbType
    });
  }
}

// API Integration Tool
export class APITool extends BaseTool {
  name = 'api';
  description = 'Make authenticated API requests to external services';
  category = 'external' as const;
  parameters = z.object({
    service: z.string(),
    endpoint: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
    data: z.any().optional(),
    headers: z.record(z.string()).optional()
  });
  permissions = {
    requiresApproval: true,
    riskLevel: 'medium' as const,
    scopes: ['external:api']
  };
  
  protected async doExecute(params: any, context: ToolContext) {
    // Get API configuration for service
    const config = await this.getApiConfig(context.userId, params.service);
    
    const response = await axios({
      method: params.method,
      url: `${config.baseUrl}${params.endpoint}`,
      data: params.data,
      headers: {
        ...config.defaultHeaders,
        ...params.headers,
        'Authorization': `Bearer ${config.apiKey}`
      }
    });
    
    return {
      status: response.status,
      data: response.data,
      headers: response.headers
    };
  }
  
  private async getApiConfig(userId: string, service: string) {
    return await context.broker.request('config.get-api', {
      userId,
      service
    });
  }
}
```

## 7. Security and Sandboxing

### 7.1 Security Architecture

```typescript
// security-service/src/index.ts
import express from 'express';
import { SandboxManager } from './sandbox/SandboxManager';
import { PermissionEngine } from './permissions/PermissionEngine';
import { AuditLogger } from './audit/AuditLogger';
import { MessageBroker } from './services/MessageBroker';

const app = express();
app.use(express.json());

export class SecurityService {
  private sandboxManager: SandboxManager;
  private permissionEngine: PermissionEngine;
  private auditLogger: AuditLogger;
  private broker: MessageBroker;
  
  constructor(broker: MessageBroker) {
    this.broker = broker;
    this.sandboxManager = new SandboxManager();
    this.permissionEngine = new PermissionEngine();
    this.auditLogger = new AuditLogger();
    
    this.setupBrokerHandlers();
  }
  
  private setupBrokerHandlers() {
    this.broker.subscribe('security.validate-tool', async (params) => {
      return await this.validateToolExecution(params);
    });
    
    this.broker.subscribe('security.create-sandbox', async (params) => {
      return await this.sandboxManager.createSandbox(params.type);
    });
    
    this.broker.subscribe('permissions.check', async (params) => {
      return await this.permissionEngine.check(params);
    });
    
    this.broker.subscribe('permissions.check-session', async (params) => {
      return await this.checkSessionAccess(params);
    });
  }
  
  async validateToolExecution(params: ValidationParams): Promise<ValidationResult> {
    // Check user permissions
    const hasPermission = await this.permissionEngine.check({
      userId: params.userId,
      resource: `tool:${params.tool}`,
      action: 'execute',
      context: params.context
    });
    
    if (!hasPermission) {
      await this.auditLogger.log({
        event: 'TOOL_EXECUTION_DENIED',
        userId: params.userId,
        tool: params.tool,
        reason: 'INSUFFICIENT_PERMISSIONS'
      });
      
      return { allowed: false, reason: 'Insufficient permissions' };
    }
    
    // Validate parameters
    const validation = await this.validateParameters(params);
    if (!validation.valid) {
      return { allowed: false, reason: validation.reason };
    }
    
    // Check rate limits
    const rateLimitOk = await this.checkRateLimit(params);
    if (!rateLimitOk) {
      return { allowed: false, reason: 'Rate limit exceeded' };
    }
    
    // Log successful validation
    await this.auditLogger.log({
      event: 'TOOL_EXECUTION_ALLOWED',
      userId: params.userId,
      tool: params.tool
    });
    
    return { allowed: true };
  }
  
  private async validateParameters(params: ValidationParams) {
    // Tool-specific parameter validation
    const validators: Record<string, (params: any) => boolean> = {
      bash: (p) => !this.containsDangerousCommand(p.command),
      write: (p) => this.isPathAllowed(p.file_path),
      database: (p) => this.isDatabaseQuerySafe(p.query)
    };
    
    const validator = validators[params.tool];
    if (validator && !validator(params.params)) {
      return { valid: false, reason: 'Invalid parameters' };
    }
    
    return { valid: true };
  }
  
  private containsDangerousCommand(command: string): boolean {
    const dangerousPatterns = [
      /rm\s+-rf\s+\//,
      /:\(\)\s*{\s*:\|:\s*&\s*}\s*;/,
      /dd\s+if=\/dev\/zero/,
      /> \/dev\/s[d|h]a/
    ];
    
    return dangerousPatterns.some(pattern => pattern.test(command));
  }
  
  private isPathAllowed(path: string): boolean {
    const deniedPaths = ['/etc', '/sys', '/proc', '/dev'];
    return !deniedPaths.some(denied => path.startsWith(denied));
  }
  
  private isDatabaseQuerySafe(query: any): boolean {
    if (typeof query === 'string') {
      // Check for dangerous SQL
      const dangerous = ['DROP', 'TRUNCATE', 'DELETE FROM'];
      return !dangerous.some(d => query.toUpperCase().includes(d));
    }
    return true;
  }
  
  private async checkSessionAccess(params: { userId: string; sessionId: string }) {
    // Check if user owns or has access to session
    const session = await this.broker.request('sessions.get', {
      sessionId: params.sessionId
    });
    
    return {
      hasAccess: session && session.userId === params.userId
    };
  }
}

// Initialize service
async function startService() {
  const nc = await connect({ servers: process.env.NATS_URL });
  const broker = new MessageBroker(nc);
  const securityService = new SecurityService(broker);
  
  const PORT = process.env.PORT || 3007;
  app.listen(PORT, () => {
    console.log(`Security service listening on port ${PORT}`);
  });
}

startService().catch(console.error);
```

### 7.2 Sandbox Manager

```typescript
// security-service/src/sandbox/SandboxManager.ts
import Docker from 'dockerode';
import { VM } from 'vm2';
import { Worker } from 'worker_threads';

export interface Sandbox {
  execute(code: string, timeout?: number): Promise<any>;
  destroy(): Promise<void>;
}

export class SandboxManager {
  private docker: Docker;
  
  constructor() {
    this.docker = new Docker();
  }
  
  async createSandbox(type: 'docker' | 'vm2' | 'worker'): Promise<Sandbox> {
    switch (type) {
      case 'docker':
        return new DockerSandbox(this.docker);
      case 'vm2':
        return new VM2Sandbox();
      case 'worker':
        return new WorkerSandbox();
    }
  }
}

// Docker Sandbox Implementation
export class DockerSandbox implements Sandbox {
  private container?: Docker.Container;
  
  constructor(private docker: Docker) {}
  
  async initialize() {
    // Create container with security restrictions
    this.container = await this.docker.createContainer({
      Image: 'opencode/sandbox:latest',
      Cmd: ['/bin/sh'],
      HostConfig: {
        Memory: 536870912, // 512MB
        CpuQuota: 50000, // 50% CPU
        NetworkMode: 'none', // No network access
        ReadonlyRootfs: true,
        Tmpfs: { '/tmp': 'size=100m' },
        SecurityOpt: [
          'no-new-privileges',
          'apparmor=docker-default',
          'seccomp=default'
        ],
        CapDrop: ['ALL']
      },
      WorkingDir: '/workspace',
      User: '1000:1000', // Non-root user
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true
    });
    
    await this.container.start();
  }
  
  async execute(command: string, timeout = 30000): Promise<any> {
    if (!this.container) {
      await this.initialize();
    }
    
    const exec = await this.container!.exec({
      Cmd: ['sh', '-c', command],
      AttachStdout: true,
      AttachStderr: true,
      User: '1000:1000'
    });
    
    const stream = await exec.start({});
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        stream.destroy();
        reject(new Error('Execution timeout'));
      }, timeout);
      
      const stdout: string[] = [];
      const stderr: string[] = [];
      
      stream.on('data', (chunk: Buffer) => {
        const str = chunk.toString();
        if (chunk[0] === 1) {
          stdout.push(str.slice(8));
        } else if (chunk[0] === 2) {
          stderr.push(str.slice(8));
        }
      });
      
      stream.on('end', async () => {
        clearTimeout(timer);
        const inspection = await exec.inspect();
        resolve({
          stdout: stdout.join(''),
          stderr: stderr.join(''),
          exitCode: inspection.ExitCode || 0
        });
      });
      
      stream.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
  
  async destroy() {
    if (this.container) {
      await this.container.stop();
      await this.container.remove();
    }
  }
}

// VM2 Sandbox Implementation
export class VM2Sandbox implements Sandbox {
  private vm: VM;
  
  constructor() {
    this.vm = new VM({
      timeout: 5000,
      sandbox: {
        console: {
          log: (...args: any[]) => console.log('[Sandbox]', ...args),
          error: (...args: any[]) => console.error('[Sandbox]', ...args)
        },
        // Limited globals
        Math,
        Date,
        JSON,
        Array,
        Object,
        String,
        Number,
        Boolean
      }
    });
  }
  
  async execute(code: string): Promise<any> {
    try {
      return this.vm.run(code);
    } catch (error) {
      throw new Error(`Sandbox execution failed: ${error.message}`);
    }
  }
  
  async destroy() {
    // VM2 doesn't need explicit cleanup
  }
}

// Worker Thread Sandbox
export class WorkerSandbox implements Sandbox {
  private worker?: Worker;
  
  async execute(code: string, timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      this.worker = new Worker(`
        const { parentPort } = require('worker_threads');
        const { VM } = require('vm2');
        
        const vm = new VM({
          timeout: ${timeout},
          sandbox: {
            console: {
              log: (...args) => parentPort.postMessage({ type: 'log', args })
            }
          }
        });
        
        try {
          const result = vm.run(\`${code}\`);
          parentPort.postMessage({ type: 'result', value: result });
        } catch (error) {
          parentPort.postMessage({ type: 'error', message: error.message });
        }
      `, { eval: true });
      
      const timer = setTimeout(() => {
        this.worker?.terminate();
        reject(new Error('Worker timeout'));
      }, timeout + 1000);
      
      this.worker.on('message', (msg) => {
        clearTimeout(timer);
        if (msg.type === 'result') {
          resolve(msg.value);
        } else if (msg.type === 'error') {
          reject(new Error(msg.message));
        }
      });
      
      this.worker.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
  
  async destroy() {
    if (this.worker) {
      await this.worker.terminate();
    }
  }
}
```

### 7.3 Permission Engine

```typescript
// security-service/src/permissions/PermissionEngine.ts
import { MongoClient, Db } from 'mongodb';

interface Policy {
  id: string;
  name: string;
  effect: 'ALLOW' | 'DENY';
  principal: string | string[];
  resource: string | string[];
  actions: string[];
  conditions?: Record<string, any>;
}

export class PermissionEngine {
  private db: Db;
  private policyCache: Map<string, Policy[]> = new Map();
  
  constructor() {
    this.initialize();
  }
  
  private async initialize() {
    const client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();
    this.db = client.db('opencode');
  }
  
  async check(params: PermissionCheckParams): Promise<boolean> {
    const userPolicies = await this.getUserPolicies(params.userId);
    
    // Check each policy
    for (const policy of userPolicies) {
      const result = await this.evaluatePolicy(policy, params);
      
      // Explicit deny takes precedence
      if (result.effect === 'DENY' && result.matches) {
        return false;
      }
      
      // Allow if matches
      if (result.effect === 'ALLOW' && result.matches) {
        return true;
      }
    }
    
    // Default deny
    return false;
  }
  
  private async getUserPolicies(userId: string): Promise<Policy[]> {
    // Check cache
    if (this.policyCache.has(userId)) {
      return this.policyCache.get(userId)!;
    }
    
    // Fetch from database
    const user = await this.db.collection('users').findOne({ _id: userId });
    const roles = user?.roles || ['user'];
    
    const policies = await this.db
      .collection<Policy>('policies')
      .find({
        $or: [
          { principal: userId },
          { principal: { $in: roles } }
        ]
      })
      .toArray();
    
    // Cache for 5 minutes
    this.policyCache.set(userId, policies);
    setTimeout(() => this.policyCache.delete(userId), 300000);
    
    return policies;
  }
  
  private async evaluatePolicy(
    policy: Policy,
    params: PermissionCheckParams
  ): Promise<{ matches: boolean; effect: 'ALLOW' | 'DENY' }> {
    // Check resource match
    const resourceMatch = this.matchPattern(
      policy.resource,
      params.resource
    );
    
    if (!resourceMatch) {
      return { matches: false, effect: policy.effect };
    }
    
    // Check action match
    const actionMatch = Array.isArray(policy.actions)
      ? policy.actions.includes(params.action) || policy.actions.includes('*')
      : policy.actions === params.action || policy.actions === '*';
    
    if (!actionMatch) {
      return { matches: false, effect: policy.effect };
    }
    
    // Evaluate conditions
    if (policy.conditions) {
      const conditionsMet = await this.evaluateConditions(
        policy.conditions,
        params.context
      );
      
      if (!conditionsMet) {
        return { matches: false, effect: policy.effect };
      }
    }
    
    return { matches: true, effect: policy.effect };
  }
  
  private matchPattern(
    pattern: string | string[],
    resource: string
  ): boolean {
    const patterns = Array.isArray(pattern) ? pattern : [pattern];
    
    return patterns.some(p => {
      if (p === '*') return true;
      if (p === resource) return true;
      
      // Wildcard matching
      const regex = new RegExp(
        '^' + p.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      );
      return regex.test(resource);
    });
  }
  
  private async evaluateConditions(
    conditions: Record<string, any>,
    context: any
  ): Promise<boolean> {
    for (const [key, value] of Object.entries(conditions)) {
      switch (key) {
        case 'IpAddress':
          if (!this.matchIpAddress(value, context.ipAddress)) {
            return false;
          }
          break;
          
        case 'StringEquals':
          for (const [field, expected] of Object.entries(value)) {
            if (context[field] !== expected) {
              return false;
            }
          }
          break;
          
        case 'DateGreaterThan':
          if (new Date(context.date) <= new Date(value)) {
            return false;
          }
          break;
          
        // Add more condition types as needed
      }
    }
    
    return true;
  }
  
  private matchIpAddress(pattern: string, ip: string): boolean {
    // Simple IP matching (extend for CIDR support)
    return pattern === ip || pattern === '*';
  }
}

// Audit Logger
export class AuditLogger {
  private db: Db;
  
  constructor() {
    this.initialize();
  }
  
  private async initialize() {
    const client = new MongoClient(process.env.MONGODB_URI!);
    await client.connect();
    this.db = client.db('opencode');
  }
  
  async log(event: AuditEvent) {
    await this.db.collection('audit_logs').insertOne({
      ...event,
      timestamp: new Date(),
      ip: event.ip || 'unknown',
      userAgent: event.userAgent || 'unknown'
    });
  }
}
```

## 8. Inter-Service Communication

### 8.1 Message Broker Implementation

```typescript
// shared/src/broker/MessageBroker.ts
import { NatsConnection, JSONCodec, JetStreamClient } from 'nats';
import { EventEmitter } from 'events';

export class MessageBroker {
  private nc: NatsConnection;
  private js: JetStreamClient;
  private codec = JSONCodec();
  private subscriptions: Map<string, any> = new Map();
  
  constructor(natsConnection: NatsConnection) {
    this.nc = natsConnection;
    this.js = natsConnection.jetstream();
  }
  
  async publish(subject: string, data: any): Promise<void> {
    await this.nc.publish(subject, this.codec.encode(data));
  }
  
  async request(subject: string, data: any, timeout = 5000): Promise<any> {
    const response = await this.nc.request(
      subject,
      this.codec.encode(data),
      { timeout }
    );
    
    return this.codec.decode(response.data);
  }
  
  async subscribe(subject: string, handler: (data: any) => Promise<void>): Promise<void> {
    const sub = this.nc.subscribe(subject);
    
    this.subscriptions.set(subject, sub);
    
    (async () => {
      for await (const msg of sub) {
        try {
          const data = this.codec.decode(msg.data);
          const result = await handler(data);
          
          if (msg.reply) {
            msg.respond(this.codec.encode(result || { success: true }));
          }
        } catch (error) {
          console.error(`Error handling message on ${subject}:`, error);
          
          if (msg.reply) {
            msg.respond(this.codec.encode({ 
              success: false, 
              error: error.message 
            }));
          }
        }
      }
    })();
  }
  
  async requestStream(subject: string, data: any): Promise<AsyncIterable<any>> {
    const inbox = this.nc.createInbox();
    const sub = this.nc.subscribe(inbox);
    
    // Send request with reply-to inbox
    await this.nc.publish(subject, this.codec.encode({
      ...data,
      replyTo: inbox
    }));
    
    // Return async iterator
    return {
      [Symbol.asyncIterator]: async function* () {
        for await (const msg of sub) {
          const decoded = this.codec.decode(msg.data);
          
          if (decoded.type === 'end') {
            sub.unsubscribe();
            return;
          }
          
          yield decoded;
        }
      }.bind(this)
    };
  }
  
  async createStream(name: string, subjects: string[]): Promise<void> {
    await this.js.streams.add({
      name,
      subjects,
      retention: 'limits',
      max_msgs: 100000,
      max_age: 7 * 24 * 60 * 60 * 1e9, // 7 days
      storage: 'file',
      replicas: 3
    });
  }
  
  async unsubscribe(subject: string): Promise<void> {
    const sub = this.subscriptions.get(subject);
    if (sub) {
      sub.unsubscribe();
      this.subscriptions.delete(subject);
    }
  }
  
  async close(): Promise<void> {
    for (const [subject, sub] of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions.clear();
    await this.nc.close();
  }
}
```

### 8.2 Service Discovery

```typescript
// shared/src/discovery/ServiceRegistry.ts
import { MessageBroker } from '../broker/MessageBroker';

interface ServiceInfo {
  name: string;
  version: string;
  endpoint: string;
  healthCheck: string;
  metadata: Record<string, any>;
  lastSeen: number;
  isLocal?: boolean;
}

export class ServiceRegistry {
  private services: Map<string, ServiceInfo> = new Map();
  private heartbeatInterval?: NodeJS.Timer;
  
  constructor(private broker: MessageBroker) {
    this.startHeartbeat();
    this.listenForServices();
  }
  
  async register(service: ServiceInfo): Promise<void> {
    service.isLocal = true;
    service.lastSeen = Date.now();
    this.services.set(service.name, service);
    
    await this.broker.publish('service.register', {
      ...service,
      timestamp: Date.now()
    });
  }
  
  async discover(serviceName: string): Promise<ServiceInfo | null> {
    // Check local cache
    const cached = this.services.get(serviceName);
    if (cached && Date.now() - cached.lastSeen < 30000) {
      return cached;
    }
    
    // Request from network
    try {
      const response = await this.broker.request(
        'service.discover',
        { name: serviceName },
        2000
      );
      
      if (response.found) {
        this.services.set(serviceName, response.service);
        return response.service;
      }
    } catch (error) {
      console.error(`Failed to discover service ${serviceName}:`, error);
    }
    
    return null;
  }
  
  async getAllServices(): Promise<ServiceInfo[]> {
    // Request all services from network
    try {
      const response = await this.broker.request('service.list', {}, 2000);
      return response.services || [];
    } catch (error) {
      // Fallback to local cache
      return Array.from(this.services.values());
    }
  }
  
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      for (const [name, service] of this.services.entries()) {
        if (service.isLocal) {
          await this.broker.publish('service.heartbeat', {
            name,
            timestamp: Date.now()
          });
        }
      }
    }, 10000); // Every 10 seconds
  }
  
  private async listenForServices() {
    // Listen for service registrations
    await this.broker.subscribe('service.register', async (data) => {
      if (!data.isLocal) {
        this.services.set(data.name, {
          ...data,
          lastSeen: Date.now(),
          isLocal: false
        });
      }
    });
    
    // Listen for heartbeats
    await this.broker.subscribe('service.heartbeat', async (data) => {
      const service = this.services.get(data.name);
      if (service && !service.isLocal) {
        service.lastSeen = Date.now();
      }
    });
    
    // Handle discovery requests
    await this.broker.subscribe('service.discover', async (data) => {
      const service = this.services.get(data.name);
      return {
        found: !!service,
        service
      };
    });
    
    // Handle list requests
    await this.broker.subscribe('service.list', async () => {
      return {
        services: Array.from(this.services.values())
      };
    });
  }
  
  async stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}
```

### 8.3 Circuit Breaker and Retry Patterns

```typescript
// shared/src/patterns/CircuitBreaker.ts
export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: Date;
  private timeout?: NodeJS.Timeout;
  
  constructor(private options: CircuitBreakerOptions) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess() {
    this.failures = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      if (this.successes >= this.options.failureThreshold) {
        this.state = 'CLOSED';
        this.successes = 0;
      }
    }
  }
  
  private onFailure() {
    this.failures++;
    this.lastFailureTime = new Date();
    
    if (this.failures >= this.options.failureThreshold) {
      this.state = 'OPEN';
      if (this.timeout) {
        clearTimeout(this.timeout);
      }
      this.timeout = setTimeout(() => {
        this.state = 'HALF_OPEN';
        this.successes = 0;
        this.failures = 0;
      }, this.options.resetTimeout);
    }
  }
  
  private shouldAttemptReset(): boolean {
    return (
      this.lastFailureTime &&
      Date.now() - this.lastFailureTime.getTime() >= this.options.resetTimeout
    );
  }
  
  getState(): string {
    return this.state;
  }
}

// Retry Policy
export interface RetryOptions {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  factor: number;
  jitter?: boolean;
}

export class RetryPolicy {
  constructor(private options: RetryOptions) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error;
    let delay = this.options.initialDelay;
    
    for (let attempt = 1; attempt <= this.options.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === this.options.maxAttempts) {
          throw error;
        }
        
        // Calculate next delay
        if (this.options.jitter) {
          // Add random jitter to prevent thundering herd
          const jitterRange = delay * 0.2;
          const jitter = Math.random() * jitterRange - jitterRange / 2;
          delay = Math.min(delay + jitter, this.options.maxDelay);
        }
        
        await this.sleep(delay);
        delay = Math.min(delay * this.options.factor, this.options.maxDelay);
      }
    }
    
    throw lastError!;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Combined resilience pattern
export class ResilientClient {
  private circuitBreaker: CircuitBreaker;
  private retryPolicy: RetryPolicy;
  
  constructor(
    circuitBreakerOptions: CircuitBreakerOptions,
    retryOptions: RetryOptions
  ) {
    this.circuitBreaker = new CircuitBreaker(circuitBreakerOptions);
    this.retryPolicy = new RetryPolicy(retryOptions);
  }
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return this.circuitBreaker.execute(() =>
      this.retryPolicy.execute(fn)
    );
  }
}
```

### 8.4 Health Check System

```typescript
// shared/src/health/HealthChecker.ts
import express from 'express';
import { MessageBroker } from '../broker/MessageBroker';

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: Record<string, {
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    timestamp: Date;
  }>;
  version: string;
  uptime: number;
}

export class HealthChecker {
  private checks: Map<string, () => Promise<boolean>> = new Map();
  private startTime: Date;
  
  constructor(private serviceName: string, private version: string) {
    this.startTime = new Date();
  }
  
  addCheck(name: string, check: () => Promise<boolean>) {
    this.checks.set(name, check);
  }
  
  async getHealth(): Promise<HealthStatus> {
    const results: HealthStatus['checks'] = {};
    let overallStatus: HealthStatus['status'] = 'healthy';
    
    for (const [name, check] of this.checks) {
      try {
        const passed = await check();
        results[name] = {
          status: passed ? 'pass' : 'fail',
          timestamp: new Date()
        };
        
        if (!passed) {
          overallStatus = 'unhealthy';
        }
      } catch (error) {
        results[name] = {
          status: 'fail',
          message: error.message,
          timestamp: new Date()
        };
        overallStatus = 'unhealthy';
      }
    }
    
    return {
      status: overallStatus,
      checks: results,
      version: this.version,
      uptime: Date.now() - this.startTime.getTime()
    };
  }
  
  setupEndpoint(app: express.Application) {
    app.get('/health', async (req, res) => {
      const health = await this.getHealth();
      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    });
    
    app.get('/ready', async (req, res) => {
      const health = await this.getHealth();
      if (health.status === 'healthy') {
        res.status(200).send('OK');
      } else {
        res.status(503).send('Not Ready');
      }
    });
  }
}

// Example usage in a service
export function setupHealthChecks(
  app: express.Application,
  broker: MessageBroker,
  db: any
) {
  const healthChecker = new HealthChecker(
    'chat-service',
    process.env.SERVICE_VERSION || '1.0.0'
  );
  
  // Add database check
  healthChecker.addCheck('database', async () => {
    try {
      await db.admin().ping();
      return true;
    } catch {
      return false;
    }
  });
  
  // Add message broker check
  healthChecker.addCheck('message-broker', async () => {
    try {
      await broker.request('ping', {}, 1000);
      return true;
    } catch {
      return false;
    }
  });
  
  // Add memory check
  healthChecker.addCheck('memory', async () => {
    const usage = process.memoryUsage();
    const limit = 1024 * 1024 * 1024; // 1GB
    return usage.heapUsed < limit;
  });
  
  healthChecker.setupEndpoint(app);
}
```

## Summary

This comprehensive guide provides a complete microservices implementation of an OpenCode-inspired AI coding assistant using Node.js with TypeScript and Express. The architecture offers:

### Key Features Implemented:
1. **All 15 OpenCode Tools**: Complete implementation with TypeScript interfaces
2. **10 Specialized Microservices**: Each handling specific concerns
3. **Robust Security**: Multiple sandboxing options, permission system, audit logging
4. **Scalable Communication**: NATS JetStream for reliable messaging
5. **Production Patterns**: Circuit breakers, retry policies, health checks
6. **Real-time Updates**: WebSocket support via Socket.io
7. **Multi-Provider AI Support**: Unified interface for various LLMs

### Architecture Advantages:
- **Independent Scaling**: Services scale based on their specific needs
- **Fault Isolation**: Problems in one service don't affect others
- **Technology Flexibility**: Each service can use optimal tools
- **Team Scalability**: Different teams can own different services
- **Easy Maintenance**: Clear separation of concerns

The implementation provides a solid foundation for building a production-ready AI coding assistant that can handle enterprise requirements while maintaining the flexibility to evolve and scale.