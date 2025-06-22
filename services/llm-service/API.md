# LLM Service API Documentation

The LLM (Large Language Model) Service provides a unified interface for interacting with various LLM providers like OpenAI and Anthropic. With Phase 3 enhancements, it now includes advanced code analysis capabilities, multi-language support, and streaming responses.

## Base URL

When accessed through the API Gateway: `http://localhost:8080/api/llm`  
Direct access: `http://localhost:4002/api/llm`

## Endpoints

### List Available Providers

List all available LLM providers and their models.

- **URL**: `/providers`
- **Method**: `GET`
- **Auth Required**: Yes (JWT)

**Headers**:
```
Authorization: Bearer [access_token]
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI",
      "models": [
        {
          "id": "gpt-4",
          "name": "GPT-4",
          "contextWindow": 8192,
          "capabilities": ["chat", "tools"]
        },
        {
          "id": "gpt-3.5-turbo",
          "name": "GPT-3.5 Turbo",
          "contextWindow": 4096,
          "capabilities": ["chat", "tools"]
        }
      ]
    },
    {
      "id": "anthropic",
      "name": "Anthropic",
      "models": [
        {
          "id": "claude-3-opus",
          "name": "Claude 3 Opus",
          "contextWindow": 200000,
          "capabilities": ["chat", "tools"]
        },
        {
          "id": "claude-3-sonnet",
          "name": "Claude 3 Sonnet",
          "contextWindow": 180000,
          "capabilities": ["chat", "tools"]
        }
      ]
    }
  ]
}
```

### Get Current Provider

Get the currently active LLM provider and model.

- **URL**: `/provider`
- **Method**: `GET`
- **Auth Required**: Yes (JWT)

**Headers**:
```
Authorization: Bearer [access_token]
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "provider": "openai",
  "model": "gpt-4",
  "config": {
    "temperature": 0.7,
    "maxTokens": 2048
  }
}
```

### Set Provider

Set the active LLM provider and model.

- **URL**: `/provider`
- **Method**: `POST`
- **Auth Required**: Yes (JWT)

**Headers**:
```
Authorization: Bearer [access_token]
Content-Type: application/json
```

**Request Body**:
```json
{
  "provider": "anthropic",
  "model": "claude-3-sonnet",
  "config": {
    "temperature": 0.5,
    "maxTokens": 4096
  }
}
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "success": true,
  "provider": "anthropic",
  "model": "claude-3-sonnet"
}
```

**Error Response**:
- **Code**: 400 Bad Request
- **Content**:
```json
{
  "error": "Provider Error",
  "message": "Unknown provider or model"
}
```

### Text Completion

Generate a text completion.

- **URL**: `/complete`
- **Method**: `POST`
- **Auth Required**: Yes (JWT)

**Headers**:
```
Authorization: Bearer [access_token]
Content-Type: application/json
```

**Request Body**:
```json
{
  "prompt": "Write a function that calculates the fibonacci sequence",
  "provider": "openai",
  "model": "gpt-4",
  "temperature": 0.7,
  "maxTokens": 1024,
  "stopSequences": ["\n\n"]
}
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "completion": "function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n-1) + fibonacci(n-2);\n}",
  "usage": {
    "promptTokens": 10,
    "completionTokens": 20,
    "totalTokens": 30
  }
}
```

**Error Response**:
- **Code**: 400 Bad Request
- **Content**:
```json
{
  "error": "Completion Error",
  "message": "Invalid prompt"
}
```

### Chat Completion

Generate a chat completion.

- **URL**: `/chat`
- **Method**: `POST`
- **Auth Required**: Yes (JWT)

**Headers**:
```
Authorization: Bearer [access_token]
Content-Type: application/json
```

**Request Body**:
```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "What is the capital of France?"
    }
  ],
  "provider": "anthropic",
  "model": "claude-3-sonnet",
  "temperature": 0.7,
  "maxTokens": 1024
}
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "message": {
    "role": "assistant",
    "content": "The capital of France is Paris."
  },
  "usage": {
    "promptTokens": 30,
    "completionTokens": 10,
    "totalTokens": 40
  }
}
```

**Error Response**:
- **Code**: 400 Bad Request
- **Content**:
```json
{
  "error": "Chat Error",
  "message": "Invalid message format"
}
```

### Tool/Function Calling

Generate a completion with tool/function calling.

- **URL**: `/tools`
- **Method**: `POST`
- **Auth Required**: Yes (JWT)

**Headers**:
```
Authorization: Bearer [access_token]
Content-Type: application/json
```

**Request Body**:
```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant with access to tools."
    },
    {
      "role": "user",
      "content": "What's the weather in New York?"
    }
  ],
  "tools": [
    {
      "name": "getWeather",
      "description": "Get the current weather in a location",
      "parameters": {
        "type": "object",
        "required": ["location"],
        "properties": {
          "location": {
            "type": "string",
            "description": "The city and state, e.g. San Francisco, CA"
          },
          "unit": {
            "type": "string",
            "enum": ["celsius", "fahrenheit"],
            "description": "The unit of temperature"
          }
        }
      }
    }
  ],
  "provider": "openai",
  "model": "gpt-4",
  "temperature": 0.7,
  "maxTokens": 1024
}
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "message": {
    "role": "assistant",
    "content": null,
    "toolCalls": [
      {
        "id": "call_abc123",
        "name": "getWeather",
        "arguments": {
          "location": "New York, NY",
          "unit": "celsius"
        }
      }
    ]
  },
  "usage": {
    "promptTokens": 150,
    "completionTokens": 30,
    "totalTokens": 180
  }
}
```

**Error Response**:
- **Code**: 400 Bad Request
- **Content**:
```json
{
  "error": "Tool Error",
  "message": "Invalid tool definition"
}
```

### Health Check

Check if the service is running.

- **URL**: `/health`
- **Method**: `GET`
- **Auth Required**: No

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "status": "ok",
  "service": "llm-service"
}
```

## Error Codes

- **400** - Bad Request: Invalid input data
- **401** - Unauthorized: Authentication failure
- **403** - Forbidden: Insufficient permissions
- **404** - Not Found: Resource not found
- **500** - Internal Server Error: Unexpected server error

## Authentication

This service uses JWT (JSON Web Tokens) for authentication. 

To authenticate API requests, include the JWT token in the Authorization header:
```
Authorization: Bearer [access_token]
```

## Code Analysis Endpoints

### Analyze Code

Analyze code to provide insights, suggestions, and documentation.

- **URL**: `/code/analyze`
- **Method**: `POST`
- **Auth Required**: Yes (JWT)

**Headers**:
```
Authorization: Bearer [access_token]
Content-Type: application/json
```

**Request Body**:
```json
{
  "code": "function calculateSum(a, b) {\n  return a + b;\n}",
  "language": "javascript",
  "analysisType": "documentation",
  "provider": "anthropic",
  "model": "claude-3-opus"
}
```

**Analysis Types**:
- `documentation`: Generate documentation for the code
- `security`: Perform security analysis to identify vulnerabilities
- `improvement`: Suggest improvements and optimizations
- `complexity`: Analyze code complexity and performance

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "analysis": {
    "documentation": "/**\n * Calculates the sum of two numbers\n * @param {number} a - First number to add\n * @param {number} b - Second number to add\n * @returns {number} The sum of a and b\n */",
    "suggestions": [
      "Consider adding type checking for parameters",
      "Function name accurately describes its purpose"
    ]
  },
  "usage": {
    "promptTokens": 45,
    "completionTokens": 120,
    "totalTokens": 165
  }
}
```

### Generate Tests

Generate unit tests for provided code.

- **URL**: `/code/tests`
- **Method**: `POST`
- **Auth Required**: Yes (JWT)

**Headers**:
```
Authorization: Bearer [access_token]
Content-Type: application/json
```

**Request Body**:
```json
{
  "code": "function calculateSum(a, b) {\n  return a + b;\n}",
  "language": "javascript",
  "testFramework": "jest",
  "provider": "anthropic",
  "model": "claude-3-opus"
}
```

**Supported Test Frameworks**:
- JavaScript: `jest`, `mocha`
- Python: `pytest`, `unittest`
- Java: `junit`
- Go: `testing`
- Rust: `rust-test`

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "tests": "describe('calculateSum', () => {\n  test('adds two positive numbers correctly', () => {\n    expect(calculateSum(2, 3)).toBe(5);\n  });\n\n  test('handles negative numbers', () => {\n    expect(calculateSum(-1, 5)).toBe(4);\n    expect(calculateSum(-1, -3)).toBe(-4);\n  });\n\n  test('handles zero', () => {\n    expect(calculateSum(0, 5)).toBe(5);\n    expect(calculateSum(5, 0)).toBe(5);\n    expect(calculateSum(0, 0)).toBe(0);\n  });\n});",
  "usage": {
    "promptTokens": 60,
    "completionTokens": 200,
    "totalTokens": 260
  }
}
```

### Refactor Code

Refactor code to improve its quality, readability, or performance.

- **URL**: `/code/refactor`
- **Method**: `POST`
- **Auth Required**: Yes (JWT)

**Headers**:
```
Authorization: Bearer [access_token]
Content-Type: application/json
```

**Request Body**:
```json
{
  "code": "function calc(x, y) {\n  var res = x + y;\n  return res;\n}",
  "language": "javascript",
  "refactorType": "modernize",
  "provider": "openai",
  "model": "gpt-4"
}
```

**Refactor Types**:
- `modernize`: Update code to use modern language features
- `performance`: Optimize for performance
- `readability`: Improve code readability
- `bestPractices`: Apply language-specific best practices

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "refactoredCode": "const calculateSum = (x, y) => x + y;",
  "changes": [
    "Renamed function from 'calc' to 'calculateSum' for better clarity",
    "Converted to arrow function syntax",
    "Removed unnecessary variable assignment",
    "Changed var to const"
  ],
  "usage": {
    "promptTokens": 50,
    "completionTokens": 100,
    "totalTokens": 150
  }
}
```

### Stream Chat Completion

Generate a chat completion with streaming response.

- **URL**: `/chat/stream`
- **Method**: `POST`
- **Auth Required**: Yes (JWT)

**Headers**:
```
Authorization: Bearer [access_token]
Content-Type: application/json
```

**Request Body**:
```json
{
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "Write a function to calculate the factorial of a number."
    }
  ],
  "provider": "anthropic",
  "model": "claude-3-sonnet",
  "temperature": 0.7,
  "maxTokens": 1024
}
```

**Success Response**:
- **Code**: 200 OK
- **Content Type**: `text/event-stream`
- **Content Format**: Server-Sent Events (SSE)

Each event has this format:
```
data: {"chunk":{"role":"assistant","content":"Here's "}}
data: {"chunk":{"role":"assistant","content":"a "}}
data: {"chunk":{"role":"assistant","content":"function "}}
...
data: {"chunk":{"role":"assistant","content":"}"}}
data: {"usage":{"promptTokens":45,"completionTokens":150,"totalTokens":195}}
data: [DONE]
```

## Examples

### Get available providers (curl)

```bash
curl http://localhost:8080/api/llm/providers \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Set provider (curl)

```bash
curl -X POST http://localhost:8080/api/llm/provider \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{"provider":"openai","model":"gpt-4","config":{"temperature":0.7}}'
```

### Chat completion (curl)

```bash
curl -X POST http://localhost:8080/api/llm/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{"messages":[{"role":"user","content":"Hello, who are you?"}],"provider":"anthropic","model":"claude-3-sonnet"}'
```

### Windows CMD Example

```cmd
curl -X POST http://localhost:8080/api/llm/chat -H "Content-Type: application/json" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Hello, who are you?\"}],\"provider\":\"anthropic\",\"model\":\"claude-3-sonnet\"}"
```

### PowerShell Example

```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/llm/chat" -Method POST -ContentType "application/json" -Headers @{"Authorization"="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."} -Body '{"messages":[{"role":"user","content":"Hello, who are you?"}],"provider":"anthropic","model":"claude-3-sonnet"}'
```

### Code Analysis Example (curl)

```bash
curl -X POST http://localhost:8080/api/llm/code/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "code": "function factorial(n) {\n  if (n <= 1) return 1;\n  return n * factorial(n-1);\n}",
    "language": "javascript",
    "analysisType": "documentation",
    "provider": "anthropic",
    "model": "claude-3-opus"
  }'
```

### Generate Tests Example (curl)

```bash
curl -X POST http://localhost:8080/api/llm/code/tests \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "code": "function factorial(n) {\n  if (n <= 1) return 1;\n  return n * factorial(n-1);\n}",
    "language": "javascript",
    "testFramework": "jest",
    "provider": "anthropic", 
    "model": "claude-3-opus"
  }'
```

### Streaming Response Example (curl)

```bash
curl -X POST http://localhost:8080/api/llm/chat/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "messages": [
      {"role": "user", "content": "Write a short poem about coding"}
    ],
    "provider": "anthropic",
    "model": "claude-3-sonnet"
  }' --no-buffer
```