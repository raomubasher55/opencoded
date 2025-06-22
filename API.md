# OpenCode API Documentation

Welcome to the OpenCode API documentation. This document provides an overview of all services and their APIs.

## Services

OpenCode is built on a microservices architecture with the following services:

1. [API Gateway](#api-gateway) - Central entry point for all services
2. [Auth Service](#auth-service) - User authentication and authorization
3. [File Service](#file-service) - File system operations
4. [LLM Service](#llm-service) - Large Language Model interactions
5. [Session Service](#session-service) - Session and conversation management
6. [Tools Service](#tools-service) - Development tools and code execution

Each service provides its own set of REST APIs, accessible through the API Gateway.

## Base URLs

| Service | Gateway URL | Direct URL | 
|---------|------------|------------|
| API Gateway | `http://localhost:8080` | N/A |
| Auth Service | `http://localhost:8080/api/auth` | `http://localhost:3003` |
| File Service | `http://localhost:8080/api/files` | `http://localhost:4001/api/files` |
| LLM Service | `http://localhost:8080/api/llm` | `http://localhost:4002/api/llm` |
| Session Service | `http://localhost:8080/api/sessions` | `http://localhost:4004/api/sessions` |
| Tools Service | `http://localhost:8080/api/tools` | `http://localhost:4003/api/tools` |

## Authentication

Most endpoints require authentication using JWT (JSON Web Tokens). To authenticate, include the JWT token in the Authorization header:

```
Authorization: Bearer [access_token]
```

To obtain an access token, use the Auth Service's login endpoint:

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

## API Gateway

The API Gateway serves as a central entry point for all OpenCode microservices, providing routing, authentication, rate limiting, and CORS support.

[Detailed API Gateway Documentation](services/api-gateway/API.md)

### Key Features

- Centralized routing to all microservices
- Authentication middleware
- Rate limiting (100 requests per 15-minute window)
- CORS support
- Security headers
- Health check endpoint

## Auth Service

The Auth Service provides user authentication, registration, and authorization functionalities.

[Detailed Auth Service Documentation](services/auth-service/API.md)

### Key Endpoints

- **POST** `/api/auth/register` - Register a new user
- **POST** `/api/auth/login` - Authenticate and receive JWT tokens
- **POST** `/api/auth/refresh-token` - Refresh an expired access token
- **POST** `/api/auth/users/:userId/api-keys` - Generate API key
- **GET** `/api/auth/github` - GitHub OAuth login
- **GET** `/api/auth/google` - Google OAuth login

## File Service

The File Service provides file system operations including reading, writing, watching, and searching files.

[Detailed File Service Documentation](services/file-service/API.md)

### Key Endpoints

- **GET** `/api/files` - List files and directories
- **GET** `/api/files/read` - Read file contents
- **POST** `/api/files/write` - Write to a file
- **POST** `/api/files/directory` - Create a directory
- **DELETE** `/api/files` - Delete a file or directory
- **GET** `/api/watch` - Watch a file or directory for changes
- **GET** `/api/search` - Search for files matching a pattern

## LLM Service

The LLM (Large Language Model) Service provides a unified interface for interacting with various LLM providers like OpenAI and Anthropic.

[Detailed LLM Service Documentation](services/llm-service/API.md)

### Key Endpoints

- **GET** `/api/llm/providers` - List available LLM providers
- **GET** `/api/llm/provider` - Get current provider
- **POST** `/api/llm/provider` - Set active provider
- **POST** `/api/llm/complete` - Generate text completion
- **POST** `/api/llm/chat` - Generate chat completion
- **POST** `/api/llm/tools` - Generate completion with tool/function calling

## Session Service

The Session Service provides conversation persistence, message history management, and session tracking.

[Detailed Session Service Documentation](services/session-service/API.md)

### Key Endpoints

- **POST** `/api/sessions` - Create a new session
- **GET** `/api/sessions/:sessionId` - Retrieve a specific session
- **PATCH** `/api/sessions/:sessionId` - Update session details
- **DELETE** `/api/sessions/:sessionId` - Delete a session
- **GET** `/api/sessions` - List all sessions for a user
- **POST** `/api/sessions/:sessionId/messages` - Add message to session
- **GET** `/api/sessions/:sessionId/messages` - Get messages from session
- **DELETE** `/api/sessions/:sessionId/messages/:messageId` - Delete a message

## Tools Service

The Tools Service provides code execution, analysis, and development tool capabilities.

[Detailed Tools Service Documentation](services/tools-service/API.md)

### Key Endpoints

- **GET** `/api/tools` - List available development tools
- **GET** `/api/tools/:toolId` - Get tool details
- **POST** `/api/executions` - Execute code in a sandboxed environment
- **GET** `/api/executions/:executionId` - Get execution status
- **POST** `/api/analysis` - Analyze code for issues and recommendations
- **GET** `/api/analysis/:analysisId` - Get analysis results
- **POST** `/api/tools/:toolId/apply` - Apply tool to code

## Testing the APIs

### Sample Test Workflow

1. Register a user:
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'
```

2. Login to get tokens:
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

3. Create a session:
```bash
curl -X POST http://localhost:8080/api/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [your_token]" \
  -d '{"userId":"[user_id]","title":"Test Session"}'
```

4. Send a message to the LLM:
```bash
curl -X POST http://localhost:8080/api/llm/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [your_token]" \
  -d '{"messages":[{"role":"user","content":"Hello, who are you?"}],"provider":"anthropic"}'
```

5. Add the message to the session:
```bash
curl -X POST http://localhost:8080/api/sessions/[session_id]/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [your_token]" \
  -d '{"role":"user","content":"Hello, who are you?"}'
```

### Windows Examples

For Windows Command Prompt, use double quotes and escape inner quotes:
```cmd
curl -X POST http://localhost:8080/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"testuser\",\"email\":\"test@example.com\",\"password\":\"password123\"}"
```

For PowerShell:
```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/auth/register" -Method POST -ContentType "application/json" -Body '{"username":"testuser","email":"test@example.com","password":"password123"}'
```

## Health Checks

All services provide a health check endpoint that can be used to verify if the service is running:

```bash
# API Gateway
curl http://localhost:8080/health

# Auth Service
curl http://localhost:8080/api/auth/health

# File Service
curl http://localhost:8080/api/files/health

# LLM Service
curl http://localhost:8080/api/llm/health

# Session Service
curl http://localhost:8080/api/sessions/health

# Tools Service
curl http://localhost:8080/api/tools/health
```