# File Service API Documentation

The File Service provides file system operations for the OpenCode platform, including reading, writing, watching, and searching files. With Phase 3 enhancements, it now includes real-time file synchronization, advanced search capabilities, and workspace management features.

## Base URL

When accessed through the API Gateway: `http://localhost:8080/api/files`, `http://localhost:8080/api/watch`, `http://localhost:8080/api/search`, `http://localhost:8080/api/workspace`  
Direct access: `http://localhost:4001/api/files`, `http://localhost:4001/api/watch`, `http://localhost:4001/api/search`, `http://localhost:4001/api/workspace`

## Endpoints

### List Files and Directories

List files and directories in a specified path.

- **URL**: `/`
- **Method**: `GET`
- **Auth Required**: Yes (JWT)

**Query Parameters**:
- `path` (string, required): The directory path to list

**Headers**:
```
Authorization: Bearer [access_token]
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "files": [
    {
      "name": "example.txt",
      "path": "/path/to/example.txt",
      "size": 1024,
      "isDirectory": false,
      "modifiedTime": "2025-06-17T20:43:22.123Z"
    },
    {
      "name": "documents",
      "path": "/path/to/documents",
      "isDirectory": true,
      "modifiedTime": "2025-06-17T20:43:22.123Z"
    }
  ]
}
```

**Error Response**:
- **Code**: 404 Not Found
- **Content**:
```json
{
  "error": "Path Error",
  "message": "Directory not found"
}
```

### Read File

Read the contents of a file.

- **URL**: `/read`
- **Method**: `GET`
- **Auth Required**: Yes (JWT)

**Query Parameters**:
- `path` (string, required): The file path to read
- `encoding` (string, optional): File encoding (default: 'utf8')

**Headers**:
```
Authorization: Bearer [access_token]
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "content": "File contents here...",
  "path": "/path/to/file.txt",
  "encoding": "utf8"
}
```

**Error Response**:
- **Code**: 404 Not Found
- **Content**:
```json
{
  "error": "File Error",
  "message": "File not found"
}
```

### Write File

Write content to a file.

- **URL**: `/write`
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
  "path": "/path/to/file.txt",
  "content": "Content to write to the file",
  "encoding": "utf8",
  "createDirectory": true
}
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "success": true,
  "path": "/path/to/file.txt",
  "bytesWritten": 28
}
```

**Error Response**:
- **Code**: 400 Bad Request
- **Content**:
```json
{
  "error": "Write Error",
  "message": "Cannot write to file"
}
```

### Create Directory

Create a new directory.

- **URL**: `/directory`
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
  "path": "/path/to/new/directory",
  "recursive": true
}
```

**Success Response**:
- **Code**: 201 Created
- **Content**:
```json
{
  "success": true,
  "path": "/path/to/new/directory"
}
```

**Error Response**:
- **Code**: 400 Bad Request
- **Content**:
```json
{
  "error": "Directory Error",
  "message": "Cannot create directory"
}
```

### Delete File or Directory

Delete a file or directory.

- **URL**: `/`
- **Method**: `DELETE`
- **Auth Required**: Yes (JWT)

**Query Parameters**:
- `path` (string, required): The path to delete
- `recursive` (boolean, optional): Whether to recursively delete directories (default: false)

**Headers**:
```
Authorization: Bearer [access_token]
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "success": true,
  "path": "/path/to/deleted/item"
}
```

**Error Response**:
- **Code**: 400 Bad Request
- **Content**:
```json
{
  "error": "Delete Error",
  "message": "Cannot delete non-empty directory without recursive flag"
}
```

### Watch File or Directory

Watch a file or directory for changes.

- **URL**: `/api/watch`
- **Method**: `GET`
- **Auth Required**: Yes (JWT)

**Query Parameters**:
- `path` (string, required): The path to watch
- `recursive` (boolean, optional): Whether to watch subdirectories (default: false)

**Headers**:
```
Authorization: Bearer [access_token]
```

**Success Response**:
- **Code**: 200 OK
- **Content-Type**: `text/event-stream`
- **Content** (sent as Server-Sent Events):
```
event: change
data: {"path":"/path/to/file.txt","type":"change"}

event: add
data: {"path":"/path/to/new.txt","type":"add"}

event: unlink
data: {"path":"/path/to/deleted.txt","type":"unlink"}
```

**Error Response**:
- **Code**: 400 Bad Request
- **Content**:
```json
{
  "error": "Watch Error",
  "message": "Invalid path"
}
```

### Search Files

Search for files matching a pattern.

- **URL**: `/api/search`
- **Method**: `GET`
- **Auth Required**: Yes (JWT)

**Query Parameters**:
- `query` (string, required): The search query
- `path` (string, required): The base path to search from
- `includeContent` (boolean, optional): Whether to include file contents in results (default: false)
- `maxResults` (number, optional): Maximum number of results to return (default: 100)

**Headers**:
```
Authorization: Bearer [access_token]
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "matches": [
    {
      "path": "/path/to/file.txt",
      "matches": [
        {
          "line": 10,
          "text": "Line containing search query",
          "column": 5
        }
      ]
    },
    {
      "path": "/path/to/another.js",
      "matches": [
        {
          "line": 25,
          "text": "Another line with search query",
          "column": 12
        }
      ]
    }
  ],
  "totalMatches": 2
}
```

**Error Response**:
- **Code**: 400 Bad Request
- **Content**:
```json
{
  "error": "Search Error",
  "message": "Invalid search query"
}
```

### Advanced Search

Perform advanced search with filters and pattern matching.

- **URL**: `/api/search/advanced`
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
  "query": "function",
  "path": "/home/user/project",
  "options": {
    "includeContent": true,
    "maxResults": 100,
    "fileTypes": [".js", ".ts", ".jsx", ".tsx"],
    "excludePatterns": ["node_modules", "dist", "build"],
    "caseSensitive": false,
    "useRegex": true,
    "contextLines": 2
  }
}
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "matches": [
    {
      "path": "/home/user/project/src/utils.js",
      "matches": [
        {
          "line": 10,
          "text": "function calculateTotal(items) {",
          "column": 0,
          "context": {
            "before": ["// Utility functions", "// Calculate the total price of items"],
            "after": ["  return items.reduce((total, item) => {", "    return total + item.price;"]
          }
        }
      ]
    }
  ],
  "totalMatches": 1,
  "searchStats": {
    "filesScanned": 25,
    "timeElapsed": "0.15s"
  }
}
```

### Real-Time File Sync

Establish a WebSocket connection for real-time file synchronization.

- **URL**: `/api/watch/sync`
- **Method**: `WebSocket`
- **Auth Required**: Yes (JWT as query parameter)

**WebSocket Connection**:
```
ws://localhost:8080/api/watch/sync?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...&path=/home/user/project
```

**Client Messages**:
```json
{
  "type": "subscribe",
  "path": "/home/user/project/src",
  "recursive": true
}
```

```json
{
  "type": "unsubscribe",
  "path": "/home/user/project/src/temp"
}
```

```json
{
  "type": "fileChanged",
  "path": "/home/user/project/src/app.js",
  "content": "const app = express();\n// Updated content...",
  "timestamp": 1687023456789
}
```

**Server Messages**:
```json
{
  "type": "fileChanged",
  "path": "/home/user/project/src/utils.js",
  "content": "function newFunction() {\n  // New content\n}",
  "timestamp": 1687023456789,
  "source": "another-user"
}
```

```json
{
  "type": "fileDeleted",
  "path": "/home/user/project/src/old.js",
  "timestamp": 1687023456789,
  "source": "another-user"
}
```

```json
{
  "type": "error",
  "message": "Failed to sync file",
  "path": "/home/user/project/src/protected.js"
}
```

### Workspace Management

#### Create Workspace

Create a new workspace.

- **URL**: `/api/workspace`
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
  "name": "My Project",
  "basePath": "/home/user/projects/my-project",
  "settings": {
    "ignoredPatterns": ["node_modules", "dist", ".git"],
    "language": "typescript",
    "fileTypes": [".ts", ".tsx", ".js", ".jsx", ".json"]
  }
}
```

**Success Response**:
- **Code**: 201 Created
- **Content**:
```json
{
  "id": "ws_12345",
  "name": "My Project",
  "basePath": "/home/user/projects/my-project",
  "created": "2025-06-17T20:43:22.123Z",
  "settings": {
    "ignoredPatterns": ["node_modules", "dist", ".git"],
    "language": "typescript",
    "fileTypes": [".ts", ".tsx", ".js", ".jsx", ".json"]
  }
}
```

#### List Workspaces

Get all workspaces for the current user.

- **URL**: `/api/workspace`
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
  "workspaces": [
    {
      "id": "ws_12345",
      "name": "My Project",
      "basePath": "/home/user/projects/my-project",
      "created": "2025-06-17T20:43:22.123Z",
      "lastAccessed": "2025-06-18T10:15:30.456Z"
    },
    {
      "id": "ws_67890",
      "name": "Another Project",
      "basePath": "/home/user/projects/another-project",
      "created": "2025-06-15T18:22:10.789Z",
      "lastAccessed": "2025-06-17T09:32:41.123Z"
    }
  ]
}
```

#### Get Workspace Details

Get details of a specific workspace.

- **URL**: `/api/workspace/:id`
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
  "id": "ws_12345",
  "name": "My Project",
  "basePath": "/home/user/projects/my-project",
  "created": "2025-06-17T20:43:22.123Z",
  "lastAccessed": "2025-06-18T10:15:30.456Z",
  "settings": {
    "ignoredPatterns": ["node_modules", "dist", ".git"],
    "language": "typescript",
    "fileTypes": [".ts", ".tsx", ".js", ".jsx", ".json"]
  },
  "stats": {
    "totalFiles": 156,
    "totalSize": "15.2MB",
    "languages": {
      "typescript": 120,
      "javascript": 25,
      "json": 11
    }
  }
}
```

#### Update Workspace

Update a workspace.

- **URL**: `/api/workspace/:id`
- **Method**: `PUT`
- **Auth Required**: Yes (JWT)

**Headers**:
```
Authorization: Bearer [access_token]
Content-Type: application/json
```

**Request Body**:
```json
{
  "name": "Updated Project Name",
  "settings": {
    "ignoredPatterns": ["node_modules", "dist", ".git", "coverage"],
    "language": "typescript"
  }
}
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "id": "ws_12345",
  "name": "Updated Project Name",
  "updated": "2025-06-18T11:22:33.456Z"
}
```

#### Delete Workspace

Delete a workspace.

- **URL**: `/api/workspace/:id`
- **Method**: `DELETE`
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
  "success": true,
  "message": "Workspace deleted successfully"
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
  "service": "file-service"
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

### List files (curl)

```bash
curl "http://localhost:8080/api/files?path=/home/user/project" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Read file (curl)

```bash
curl "http://localhost:8080/api/files/read?path=/home/user/project/example.txt" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Write file (curl)

```bash
curl -X POST "http://localhost:8080/api/files/write" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{"path":"/home/user/project/new-file.txt","content":"Hello, world!","createDirectory":true}'
```

### Search files (curl)

```bash
curl "http://localhost:8080/api/search?query=function&path=/home/user/project&includeContent=true" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Windows CMD Example

```cmd
curl "http://localhost:8080/api/files/read?path=/home/user/project/example.txt" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### PowerShell Example

```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/files/write" -Method POST -ContentType "application/json" -Headers @{"Authorization"="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."} -Body '{"path":"/home/user/project/new-file.txt","content":"Hello, world!","createDirectory":true}'
```

### Advanced Search Example (curl)

```bash
curl -X POST "http://localhost:8080/api/search/advanced" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "query": "function",
    "path": "/home/user/project",
    "options": {
      "includeContent": true,
      "maxResults": 50,
      "fileTypes": [".js", ".ts"],
      "excludePatterns": ["node_modules"],
      "contextLines": 2
    }
  }'
```

### Create Workspace Example (curl)

```bash
curl -X POST "http://localhost:8080/api/workspace" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "name": "My TypeScript Project",
    "basePath": "/home/user/projects/ts-project",
    "settings": {
      "ignoredPatterns": ["node_modules", "dist"],
      "language": "typescript"
    }
  }'
```

### WebSocket File Sync Example (JavaScript)

```javascript
// Client-side JavaScript
const socket = new WebSocket(`ws://localhost:8080/api/watch/sync?token=${jwtToken}&path=/home/user/project`);

socket.onopen = () => {
  console.log('WebSocket connection established');
  
  // Subscribe to a directory
  socket.send(JSON.stringify({
    type: 'subscribe',
    path: '/home/user/project/src',
    recursive: true
  }));
};

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'fileChanged') {
    console.log(`File changed: ${data.path}`);
    // Update UI or local file
    updateFile(data.path, data.content);
  } else if (data.type === 'fileDeleted') {
    console.log(`File deleted: ${data.path}`);
    // Update UI
    removeFile(data.path);
  } else if (data.type === 'error') {
    console.error(`Error: ${data.message}`);
  }
};

// Send file changes to server
function sendFileChange(path, content) {
  socket.send(JSON.stringify({
    type: 'fileChanged',
    path,
    content,
    timestamp: Date.now()
  }));
}
```