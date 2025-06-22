# OpenCode Microservices API Documentation (Phase 3)

This document provides comprehensive information about all the endpoints available in the OpenCode microservices architecture, including new features added in Phase 3.

## Base URLs

All services are accessible through the API Gateway at the following base URL:

```
http://localhost:8080/api
```

Individual services can also be accessed directly at their respective ports:

- **Auth Service**: http://localhost:3003
- **File Service**: http://localhost:4001
- **LLM Service**: http://localhost:4002
- **Tools Service**: http://localhost:4003
- **Session Service**: http://localhost:4004

## Authentication

Most endpoints require authentication using JSON Web Tokens (JWT). To authenticate:

1. Obtain a token by logging in via the Auth Service
2. Include the token in the Authorization header of subsequent requests:
   ```
   Authorization: Bearer <your_token>
   ```

## Services Overview

### Auth Service

Handles user authentication, registration, and API key management.

**Endpoints:**
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Authenticate and get JWT tokens
- `POST /api/auth/refresh-token` - Refresh an expired JWT token
- `POST /api/auth/users/:userId/api-keys` - Generate API keys for a user
- `GET /api/auth/me` - Get current user information
- `GET /api/auth/users` - List users (admin only)
- `PATCH /api/auth/users/:userId` - Update a user (admin or self)
- `DELETE /api/auth/users/:userId` - Delete a user (admin only)
- `GET /api/auth/github` - GitHub OAuth authentication
- `GET /api/auth/github/callback` - GitHub OAuth callback
- `GET /api/auth/google` - Google OAuth authentication
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/health` - Service health check

### File Service

Provides file system operations such as reading, writing, and searching files.

**Endpoints:**
- `GET /api/files` - List files in a directory
- `GET /api/files/read` - Read file content
- `POST /api/files/write` - Write to a file
- `POST /api/files/directory` - Create a directory
- `DELETE /api/files` - Delete a file or directory
- `GET /api/watch` - Watch for file changes
- `GET /api/search` - Search for files matching a pattern
- `GET /api/search/content` - Search file contents with regex
- `GET /api/files/health` - Service health check

### LLM Service

Provides a unified interface to various Large Language Model providers and advanced code analysis capabilities.

#### Core LLM Endpoints
- `GET /api/llm/providers` - List available LLM providers
- `GET /api/llm/provider` - Get current provider
- `POST /api/llm/provider` - Set active provider
- `GET /api/llm/models` - List available models
- `POST /api/llm/complete` - Generate text completion
- `POST /api/llm/chat` - Generate chat completion
- `POST /api/llm/tools` - Generate completion with tool/function calling
- `POST /api/llm/tokens/count` - Count tokens in a prompt
- `GET /api/llm/templates` - List available prompt templates
- `GET /api/llm/templates/:name` - Get a specific prompt template
- `POST /api/llm/templates/:name` - Create or update a prompt template
- `DELETE /api/llm/templates/:name` - Delete a prompt template
- `POST /api/llm/templates/:name/render` - Render a prompt template
- `GET /api/llm/health` - Service health check

#### Code Analysis Endpoints (New in Phase 3)
- `POST /api/code-analysis/documentation` - Generate documentation for code
- `POST /api/code-analysis/tests` - Generate tests for code
- `POST /api/code-analysis/security` - Analyze code for security issues
- `POST /api/code-analysis/improvements` - Suggest code improvements
- `POST /api/code-analysis/refactor` - Refactor code
- `POST /api/code-analysis/explain` - Explain code
- `POST /api/code-analysis/project` - Analyze project structure
- `POST /api/code-analysis/generate` - Generate code from description

### Session Service

Manages conversation history and context management.

**Endpoints:**
- `POST /api/sessions` - Create a new session
- `GET /api/sessions/:sessionId` - Get a specific session
- `PATCH /api/sessions/:sessionId` - Update a session
- `DELETE /api/sessions/:sessionId` - Delete a session
- `GET /api/sessions` - List all sessions for the current user
- `POST /api/sessions/:sessionId/messages` - Add a message to a session
- `GET /api/sessions/:sessionId/messages` - Get all messages in a session
- `DELETE /api/sessions/:sessionId/messages/:messageId` - Delete a message
- `GET /api/sessions/health` - Service health check

### Tools Service

Provides code execution, analysis, and development tool capabilities. Enhanced in Phase 3 with multi-language support and Docker container isolation.

#### Tool Management
- `GET /api/tools` - List all available tools
- `GET /api/tools/:id` - Get details of a specific tool
- `POST /api/tools` - Create a new tool (admin only)
- `PUT /api/tools/:id` - Update a tool (admin only)
- `DELETE /api/tools/:id` - Delete a tool (admin only)
- `POST /api/tools/:id/apply` - Apply a tool to code

#### Code Execution (Enhanced in Phase 3)
- `POST /api/executions` - Execute code in a secure sandbox
  - New: Multi-language support (JavaScript, TypeScript, Python, Java, Go, Rust)
  - New: Docker container isolation
  - New: Dependency management
- `GET /api/executions/:id` - Get execution status and result
- `GET /api/executions/user` - List all executions for the current user
- `DELETE /api/executions/:id` - Cancel an execution

#### Code Analysis
- `POST /api/analysis` - Analyze code (general)
- `POST /api/analysis/ast` - Parse code into AST
- `POST /api/analysis/quality` - Analyze code quality
- `POST /api/analysis/dependencies` - Analyze code dependencies
- `POST /api/analysis/security` - Scan code for security vulnerabilities
- `GET /api/analysis/:id` - Get analysis results
- `GET /api/tools/health` - Service health check

## Real-time Communication (New in Phase 3)

OpenCode now supports real-time communication using WebSockets.

### Endpoints

- **WebSocket** `ws://localhost:8080/socket.io` - Main WebSocket connection

### Events

- `message` - Receive chat messages
- `message:chunk` - Receive streaming chunks of a message
- `execution:started` - Tool execution started
- `execution:progress` - Tool execution progress updates
- `execution:completed` - Tool execution completed
- `execution:failed` - Tool execution failed
- `tool:output` - Output from a tool (stdout/stderr)
- `session:update` - Session updates

## Rate Limiting (Enhanced in Phase 3)

The rate limiting now supports different tiers based on the user's plan.

| Plan | Requests per Minute |
|------|---------------------|
| Free | 30 |
| Starter | 100 |
| Professional | 300 |
| Enterprise | 1000 |

## Examples

### Execute Code (Multi-language support)

```bash
# JavaScript execution
curl -X POST http://localhost:8080/api/executions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_token>" \
  -d '{
    "language": "javascript",
    "code": "console.log(\"Hello, world!\"); const x = 10; const y = 20; console.log(x + y);",
    "container": true,
    "timeout": 5000
  }'

# Python execution
curl -X POST http://localhost:8080/api/executions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_token>" \
  -d '{
    "language": "python",
    "code": "print(\"Hello, world!\")\nx = 10\ny = 20\nprint(x + y)",
    "container": true,
    "timeout": 5000
  }'
```

### Generate Code Documentation

```bash
curl -X POST http://localhost:8080/api/code-analysis/documentation \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_token>" \
  -d '{
    "code": "function add(a, b) { return a + b; }",
    "language": "javascript"
  }'
```

### Generate Tests

```bash
curl -X POST http://localhost:8080/api/code-analysis/tests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <your_token>" \
  -d '{
    "code": "function add(a, b) { return a + b; }",
    "language": "javascript",
    "testFramework": "jest"
  }'
```

## Detailed Documentation

For detailed documentation on each service, please refer to the following:

- [Auth Service API Documentation](./services/auth-service/API.md)
- [File Service API Documentation](./services/file-service/API.md)
- [LLM Service API Documentation](./services/llm-service/API.md)
- [Tools Service API Documentation](./services/tools-service/API.md)
- [Session Service API Documentation](./services/session-service/API.md)

## Testing

Test scripts for each service are available in their respective directories:

```bash
# Auth Service tests
./services/auth-service/test-endpoints.sh

# File Service tests
./services/file-service/test-endpoints.sh

# LLM Service tests
./services/llm-service/test-endpoints.sh

# Tools Service tests
./services/tools-service/test-endpoints.sh
./services/tools-service/test-endpoints-all.sh  # Comprehensive tests

# Session Service tests
./services/session-service/test-endpoints.sh
```

## Error Handling

All services follow a consistent error response format:

```json
{
  "success": false,
  "message": "Error message describing what went wrong",
  "error": {
    "code": "ERROR_CODE",
    "details": {}  // Optional additional details
  }
}
```

Common HTTP status codes:
- **200 OK** - Request successful
- **201 Created** - Resource created successfully
- **400 Bad Request** - Invalid input
- **401 Unauthorized** - Authentication required
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Resource not found
- **429 Too Many Requests** - Rate limit exceeded
- **500 Internal Server Error** - Server error