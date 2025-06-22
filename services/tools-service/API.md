# Tools Service API Documentation

The Tools Service provides code execution, analysis, and development tool capabilities for the OpenCode platform. With Phase 3 enhancements, it now includes multi-language execution environments, real-time execution monitoring, and advanced code analysis features.

## Base URL

When accessed through the API Gateway: `http://localhost:8080/api/tools`, `http://localhost:8080/api/executions`, `http://localhost:8080/api/analysis`  
Direct access: `http://localhost:4003/api/tools`, `http://localhost:4003/api/executions`, `http://localhost:4003/api/analysis`

## Endpoints

### List Available Tools

List all available development tools.

- **URL**: `/`
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
  "tools": [
    {
      "id": "code-linter",
      "name": "Code Linter",
      "description": "Lint code for style and common errors",
      "supportedLanguages": ["javascript", "typescript", "python"],
      "configOptions": ["strict", "fix"]
    },
    {
      "id": "code-formatter",
      "name": "Code Formatter",
      "description": "Format code according to style guidelines",
      "supportedLanguages": ["javascript", "typescript", "python", "java"],
      "configOptions": ["tabWidth", "printWidth"]
    },
    {
      "id": "test-runner",
      "name": "Test Runner",
      "description": "Run automated tests",
      "supportedLanguages": ["javascript", "typescript", "python"],
      "configOptions": ["watch", "coverage"]
    }
  ]
}
```

### Get Tool Details

Get detailed information about a specific tool.

- **URL**: `/:toolId`
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
  "id": "code-linter",
  "name": "Code Linter",
  "description": "Lint code for style and common errors",
  "supportedLanguages": ["javascript", "typescript", "python"],
  "configOptions": ["strict", "fix"],
  "version": "1.0.0",
  "documentation": "https://docs.example.com/code-linter"
}
```

**Error Response**:
- **Code**: 404 Not Found
- **Content**:
```json
{
  "error": "Not Found",
  "message": "Tool not found"
}
```

### Execute Code

Execute code in a sandboxed environment.

- **URL**: `/api/executions`
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
  "language": "javascript",
  "code": "console.log('Hello, world!'); const x = 10; const y = 20; console.log(x + y);",
  "timeout": 5000,
  "environment": {
    "NODE_ENV": "development"
  },
  "dependencies": [],
  "executionMode": "synchronous"
}
```

**Supported Languages**:
- `javascript` / `nodejs` - Node.js environment
- `typescript` - TypeScript compiled to JavaScript
- `python` - Python 3 environment
- `java` - Java environment
- `go` - Go environment
- `rust` - Rust environment
- `shell` - Bash shell environment

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "executionId": "exec_123456",
  "status": "completed",
  "stdout": "Hello, world!\n30\n",
  "stderr": "",
  "exitCode": 0,
  "executionTime": 120,
  "memoryUsage": 12400000
}
```

**Error Response**:
- **Code**: 400 Bad Request
- **Content**:
```json
{
  "error": "Execution Error",
  "message": "Syntax error in code"
}
```

### Execute Code with Dependencies

Execute code with specified dependencies in a sandboxed environment.

- **URL**: `/api/executions/with-deps`
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
  "language": "javascript",
  "code": "const _ = require('lodash'); console.log(_.camelCase('Hello World'));",
  "dependencies": [
    {
      "name": "lodash",
      "version": "4.17.21"
    }
  ],
  "timeout": 10000,
  "environment": {
    "NODE_ENV": "development"
  }
}
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "executionId": "exec_789012",
  "status": "completed",
  "stdout": "helloWorld\n",
  "stderr": "",
  "exitCode": 0,
  "executionTime": 350,
  "memoryUsage": 18600000
}
```

### Stream Execution

Execute code and stream the output in real-time.

- **URL**: `/api/executions/stream`
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
  "language": "python",
  "code": "import time\nfor i in range(5):\n    print(f'Count: {i}')\n    time.sleep(1)",
  "timeout": 10000
}
```

**Success Response**:
- **Code**: 200 OK
- **Content-Type**: `text/event-stream`
- **Content Format**: Server-Sent Events (SSE)

Each event has this format:
```
event: stdout
data: Count: 0

event: stdout
data: Count: 1

event: stdout
data: Count: 2

event: stdout
data: Count: 3

event: stdout
data: Count: 4

event: result
data: {"status":"completed","exitCode":0,"executionTime":5120,"memoryUsage":8400000}
```

If an error occurs:
```
event: stderr
data: SyntaxError: invalid syntax

event: error
data: {"status":"failed","error":"Execution failed with syntax error"}
```

### Get Execution Status

Get the status of a code execution.

- **URL**: `/api/executions/:executionId`
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
  "executionId": "exec_123456",
  "status": "completed",
  "language": "javascript",
  "startTime": "2025-06-17T20:43:22.123Z",
  "endTime": "2025-06-17T20:43:22.243Z",
  "stdout": "Hello, world!\n30\n",
  "stderr": "",
  "exitCode": 0,
  "executionTime": 120,
  "memoryUsage": 12400000
}
```

**Error Response**:
- **Code**: 404 Not Found
- **Content**:
```json
{
  "error": "Not Found",
  "message": "Execution not found"
}
```

### Execute in Container

Execute code in an isolated Docker container with custom runtime environments.

- **URL**: `/api/executions/container`
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
  "language": "python",
  "code": "import numpy as np\narray = np.array([1, 2, 3, 4, 5])\nprint(f'Mean: {np.mean(array)}')",
  "timeout": 15000,
  "container": {
    "image": "python:3.9-slim",
    "dependencies": ["numpy==1.23.0"],
    "setup": "pip install numpy==1.23.0",
    "memoryLimit": "512m",
    "cpuLimit": "1.0"
  }
}
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "executionId": "exec_567890",
  "status": "completed",
  "stdout": "Mean: 3.0\n",
  "stderr": "",
  "exitCode": 0,
  "executionTime": 2350,
  "memoryUsage": 76800000,
  "container": {
    "id": "container_abc123",
    "image": "python:3.9-slim",
    "status": "exited"
  }
}
```

**Error Response**:
- **Code**: 400 Bad Request
- **Content**:
```json
{
  "error": "Container Error",
  "message": "Failed to create container"
}
```

### Code Analysis

Analyze code for issues, complexity, and recommendations with enhanced capabilities.

- **URL**: `/api/analysis`
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
  "language": "javascript",
  "code": "function factorial(n) { if (n <= 1) return 1; return n * factorial(n - 1); }",
  "analysisTypes": ["complexity", "security", "performance", "bestPractices", "documentation"],
  "detailed": true,
  "includeSuggestions": true,
  "includeExamples": true
}
```

**Analysis Types**:
- `complexity` - Analyze code complexity (cyclomatic, cognitive)
- `security` - Identify security vulnerabilities
- `performance` - Detect performance issues
- `bestPractices` - Check for adherence to best practices
- `documentation` - Analyze quality of comments and documentation
- `style` - Check code style and formatting
- `dependencies` - Analyze dependencies for issues

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "analysisId": "analysis_789012",
  "language": "javascript",
  "summary": {
    "complexity": "low",
    "security": "high",
    "performance": "medium",
    "bestPractices": "medium",
    "documentation": "low"
  },
  "metrics": {
    "cyclomaticComplexity": 2,
    "cognitiveComplexity": 1,
    "maintainabilityIndex": 85,
    "linesOfCode": 1,
    "commentLines": 0,
    "commentRatio": 0
  },
  "findings": [
    {
      "type": "complexity",
      "severity": "info",
      "message": "Recursive function with linear complexity",
      "line": 1,
      "column": 10
    },
    {
      "type": "performance",
      "severity": "warning",
      "message": "Recursive function may cause stack overflow with large inputs",
      "line": 1,
      "column": 42,
      "recommendation": "Consider using iteration instead of recursion",
      "example": "function factorial(n) {\n  let result = 1;\n  for (let i = 2; i <= n; i++) {\n    result *= i;\n  }\n  return result;\n}"
    },
    {
      "type": "documentation",
      "severity": "info",
      "message": "Function lacks documentation",
      "line": 1,
      "column": 1,
      "recommendation": "Add JSDoc comment to describe function purpose, parameters, and return value",
      "example": "/**\n * Calculates the factorial of a number\n * @param {number} n - The input number\n * @returns {number} The factorial of n\n */\nfunction factorial(n) { if (n <= 1) return 1; return n * factorial(n - 1); }"
    }
  ]
}
```

**Error Response**:
- **Code**: 400 Bad Request
- **Content**:
```json
{
  "error": "Analysis Error",
  "message": "Unsupported language"
}
```

### Get Analysis Results

Get detailed results of a previous code analysis.

- **URL**: `/api/analysis/:analysisId`
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
  "analysisId": "analysis_789012",
  "language": "javascript",
  "status": "completed",
  "createdAt": "2025-06-17T20:43:22.123Z",
  "summary": {
    "complexity": "low",
    "security": "high",
    "performance": "medium"
  },
  "metrics": {
    "cyclomaticComplexity": 2,
    "maintainabilityIndex": 85,
    "linesOfCode": 1
  },
  "findings": [
    {
      "type": "complexity",
      "severity": "info",
      "message": "Recursive function with linear complexity",
      "line": 1,
      "column": 10
    },
    {
      "type": "performance",
      "severity": "warning",
      "message": "Recursive function may cause stack overflow with large inputs",
      "line": 1,
      "column": 42,
      "recommendation": "Consider using iteration instead of recursion"
    }
  ]
}
```

**Error Response**:
- **Code**: 404 Not Found
- **Content**:
```json
{
  "error": "Not Found",
  "message": "Analysis not found"
}
```

### Apply Tool to Code

Apply a specific development tool to code.

- **URL**: `/:toolId/apply`
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
  "language": "javascript",
  "code": "function add(a,b){return a+b}",
  "config": {
    "fix": true,
    "tabWidth": 2
  }
}
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "original": "function add(a,b){return a+b}",
  "modified": "function add(a, b) {\n  return a + b;\n}",
  "changes": [
    {
      "type": "formatting",
      "line": 1,
      "description": "Added spacing between parameters"
    },
    {
      "type": "formatting",
      "line": 1,
      "description": "Added proper block formatting"
    }
  ],
  "warnings": []
}
```

**Error Response**:
- **Code**: 400 Bad Request
- **Content**:
```json
{
  "error": "Tool Error",
  "message": "Unsupported language for this tool"
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
  "service": "tools-service"
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

## Examples

### List available tools (curl)

```bash
curl http://localhost:8080/api/tools \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Execute code (curl)

```bash
curl -X POST http://localhost:8080/api/executions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{"language":"javascript","code":"console.log(\"Hello, world!\");"}'
```

### Analyze code (curl)

```bash
curl -X POST http://localhost:8080/api/analysis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{"language":"javascript","code":"function add(a,b){return a+b}","analysisTypes":["complexity","style"]}'
```

### Windows CMD Example

```cmd
curl -X POST http://localhost:8080/api/executions -H "Content-Type: application/json" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." -d "{\"language\":\"javascript\",\"code\":\"console.log(\\\"Hello, world!\\\");\"}"
```

### PowerShell Example

```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/analysis" -Method POST -ContentType "application/json" -Headers @{"Authorization"="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."} -Body '{"language":"javascript","code":"function add(a,b){return a+b}","analysisTypes":["complexity","style"]}'
```

### Execute Python with Dependencies (curl)

```bash
curl -X POST http://localhost:8080/api/executions/with-deps \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "language": "python",
    "code": "import pandas as pd\nimport numpy as np\n\ndata = pd.DataFrame({\n    \"A\": np.random.rand(5),\n    \"B\": np.random.rand(5)\n})\nprint(data.describe())",
    "dependencies": [
      {"name": "pandas", "version": "1.5.3"},
      {"name": "numpy", "version": "1.23.5"}
    ],
    "timeout": 15000
  }'
```

### Stream Code Execution (curl)

```bash
curl -X POST http://localhost:8080/api/executions/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "language": "javascript",
    "code": "for (let i = 0; i < 5; i++) {\n  console.log(`Iteration ${i}`);\n  // Simulate work\n  let start = Date.now();\n  while (Date.now() - start < 1000) {}\n}"
  }' --no-buffer
```

### Execute in Container (curl)

```bash
curl -X POST http://localhost:8080/api/executions/container \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "language": "python",
    "code": "import tensorflow as tf\nprint(tf.__version__)\nmodel = tf.keras.Sequential([\n  tf.keras.layers.Dense(128, activation=\"relu\"),\n  tf.keras.layers.Dense(10, activation=\"softmax\")\n])\nprint(model.summary())",
    "container": {
      "image": "tensorflow/tensorflow:latest",
      "memoryLimit": "1g",
      "cpuLimit": "1.0"
    },
    "timeout": 30000
  }'
```

### Advanced Code Analysis (curl)

```bash
curl -X POST http://localhost:8080/api/analysis \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "language": "javascript",
    "code": "function processData(data) {\n  let results = [];\n  for (let i = 0; i < data.length; i++) {\n    if (data[i].active) {\n      for (let j = 0; j < data[i].items.length; j++) {\n        results.push(data[i].items[j].value * 2);\n      }\n    }\n  }\n  return results;\n}",
    "analysisTypes": ["complexity", "performance", "bestPractices"],
    "detailed": true,
    "includeSuggestions": true,
    "includeExamples": true
  }'
```