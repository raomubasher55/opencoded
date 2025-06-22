# File Service API Endpoints

## Overview
The File Service provides comprehensive file operations, search capabilities, and secure terminal command execution.

## Base URLs
- **Direct Service**: `http://localhost:4001`
- **Via API Gateway**: `http://localhost:8080`

## Authentication
All API endpoints require JWT authentication via the `Authorization: Bearer <token>` header.

---

## File Operations Endpoints

### 1. Read File
**GET** `/api/files/read?path=<file_path>`

Read the contents of a file.

**Query Parameters:**
- `path` (required): Path to the file

**Response:**
```json
{
  "success": true,
  "data": "file content here..."
}
```

### 2. Write File
**POST** `/api/files/write`

Write content to a file.

**Body:**
```json
{
  "path": "/path/to/file.txt",
  "content": "File content here",
  "createDirectory": true
}
```

### 3. List Files
**GET** `/api/files?path=<directory_path>`

List files and folders in a directory.

**Query Parameters:**
- `path` (required): Path to the directory

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "file.txt",
      "isDirectory": false,
      "size": 1024,
      "modifiedTime": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

### 4. Delete File/Directory
**DELETE** `/api/files?path=<target_path>&recursive=<true|false>`

Delete a file or directory.

**Query Parameters:**
- `path` (required): Path to delete
- `recursive` (optional): Delete directories recursively

---

## Search Endpoints

### 1. Search File Contents
**GET** `/api/search/content/<pattern>/<path>`

Search for text patterns within file contents.

**URL Parameters:**
- `pattern` (required): Search pattern (regex supported)
- `path` (required): Directory path to search in

**Query Parameters:**
- `includePattern`: File patterns to include (e.g., "*.js")
- `excludePattern`: File patterns to exclude
- `caseSensitive`: Case-sensitive search (true/false)
- `maxResults`: Maximum number of results
- `maxDepth`: Maximum directory depth

**Example:**
```
GET /api/search/content/express/./src?includePattern=*.js&caseSensitive=false&maxResults=50
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": {
      "pattern": "express",
      "path": "./src",
      "options": { "caseSensitive": false }
    },
    "results": [
      {
        "file": "/path/to/file.js",
        "line": 5,
        "content": "const express = require('express');",
        "column": 6,
        "matchLength": 7
      }
    ],
    "totalMatches": 1,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### 2. Search Files by Name
**GET** `/api/search/files/<pattern>/<path>`

Search for files by filename pattern.

**URL Parameters:**
- `pattern` (required): Filename pattern
- `path` (required): Directory path to search in

**Query Parameters:**
- `maxResults`: Maximum number of results
- `maxDepth`: Maximum directory depth

**Example:**
```
GET /api/search/files/config/./src
```

**Response:**
```json
{
  "success": true,
  "data": {
    "query": {
      "pattern": "config",
      "path": "./src",
      "type": "filename"
    },
    "results": [
      {
        "file": "/path/to/config.js",
        "name": "config.js"
      }
    ],
    "totalMatches": 1,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

---

## Terminal Endpoints

### 1. Execute Command
**POST** `/api/terminal/execute`

Execute a terminal command and get the complete result.

**Body:**
```json
{
  "command": "npm run dev",
  "cwd": "/path/to/project",
  "timeout": 30000,
  "shell": "/bin/bash"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "command": "npm run dev",
    "result": {
      "stdout": "Server started on port 3000",
      "stderr": "",
      "exitCode": 0,
      "executionTime": 1250
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

### 2. Execute Streaming Command
**POST** `/api/terminal/stream`

Execute a command with real-time streaming output using Server-Sent Events.

**Body:**
```json
{
  "command": "npm install",
  "cwd": "/path/to/project",
  "timeout": 300000
}
```

**Response:** Server-Sent Events stream with messages:
```
data: {"type":"start","command":"npm install","timestamp":"..."}

data: {"type":"output","stream":"stdout","data":"Installing packages...","timestamp":"..."}

data: {"type":"output","stream":"stderr","data":"Warning: ...","timestamp":"..."}

data: {"type":"complete","result":{"stdout":"...","stderr":"...","exitCode":0},"timestamp":"..."}
```

### 3. Get Command Information
**GET** `/api/terminal/info`

Get information about available commands and security settings.

**Response:**
```json
{
  "success": true,
  "data": {
    "commonCommands": {
      "Node.js/JavaScript": [
        "npm install - Install dependencies",
        "npm run dev - Start development server"
      ],
      "Git": [
        "git status - Check repository status"
      ]
    },
    "securityInfo": {
      "strictMode": false,
      "allowedPaths": ["/current/working/directory"],
      "maxTimeout": 300000,
      "dangerousCommandsBlocked": true
    },
    "platform": "linux",
    "shell": "/bin/bash"
  }
}
```

### 4. Get Current Directory
**GET** `/api/terminal/cwd`

Get the current working directory.

**Response:**
```json
{
  "success": true,
  "data": {
    "currentDirectory": "/path/to/current/directory",
    "platform": "linux",
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

---

## File Watching Endpoints

### 1. Watch Directory
**GET** `/api/watch?path=<directory_path>`

Watch a directory for file changes (Server-Sent Events).

**Query Parameters:**
- `path` (required): Directory path to watch

**Response:** Real-time file change events

---

## Security Features

### Terminal Security
- **Command Whitelist**: Only approved commands are allowed in strict mode
- **Dangerous Command Blocking**: Commands like `rm`, `del`, `format` are blocked
- **Path Validation**: Commands can only execute within allowed directories
- **Timeout Protection**: Maximum execution time limits
- **Pattern Detection**: Blocks dangerous command patterns and substitutions

### File Operations Security
- **Path Validation**: Access restricted to allowed directories
- **Binary File Detection**: Automatic detection and handling of binary files
- **Directory Traversal Protection**: Prevents access outside allowed paths

---

## Common Use Cases

### 1. Development Workflow
```bash
# Start development server
POST /api/terminal/execute
{"command": "npm run dev", "cwd": "/project/path"}

# Watch for file changes
GET /api/watch?path=/project/src

# Search for TODO comments
GET /api/search/content/TODO/./src?includePattern=*.js
```

### 2. Project Management
```bash
# Install dependencies
POST /api/terminal/stream
{"command": "npm install", "timeout": 300000}

# Find configuration files
GET /api/search/files/config/./

# Check project structure
GET /api/files?path=./
```

### 3. Code Search and Analysis
```bash
# Search for function definitions
GET /api/search/content/function%20\w+/./src?includePattern=*.js

# Find all test files
GET /api/search/files/test/./?maxDepth=3

# Search for specific imports
GET /api/search/content/import.*express/./src
```

---

## Error Handling

All endpoints return standardized error responses:

```json
{
  "success": false,
  "message": "Error description",
  "type": "error_type"
}
```

Common error types:
- `validation_error`: Invalid request parameters
- `permission_error`: Access denied
- `execution_error`: Command execution failed
- `not_found_error`: File or directory not found
- `security_error`: Security violation detected