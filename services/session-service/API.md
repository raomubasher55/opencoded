# Session Service API Documentation

The Session Service provides conversation persistence, message history management, and session tracking for the OpenCode platform. With Phase 3 enhancements, it now includes real-time communication capabilities, session sharing, and enhanced message contextual metadata.

## Base URL

When accessed through the API Gateway: `http://localhost:8080/api/sessions`  
Direct access: `http://localhost:4004/api/sessions`  
WebSocket endpoint: `ws://localhost:8080/api/sessions/live` or `ws://localhost:4004/api/sessions/live`

## Endpoints

### Create Session

Create a new conversation session.

- **URL**: `/`
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
  "userId": "60d21b4667d0d8992e610c85",
  "title": "Python Debugging Session",
  "metadata": {
    "project": "my-python-app",
    "tags": ["debugging", "python"]
  }
}
```

**Success Response**:
- **Code**: 201 Created
- **Content**:
```json
{
  "id": "61f2a3b4c5d6e7f8a9b0c1d2",
  "userId": "60d21b4667d0d8992e610c85",
  "title": "Python Debugging Session",
  "metadata": {
    "project": "my-python-app",
    "tags": ["debugging", "python"]
  },
  "createdAt": "2025-06-17T20:43:22.123Z",
  "updatedAt": "2025-06-17T20:43:22.123Z"
}
```

**Error Response**:
- **Code**: 400 Bad Request
- **Content**:
```json
{
  "error": "Validation Error",
  "message": "UserId is required"
}
```

### Get Session

Retrieve a specific session by ID.

- **URL**: `/:sessionId`
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
  "id": "61f2a3b4c5d6e7f8a9b0c1d2",
  "userId": "60d21b4667d0d8992e610c85",
  "title": "Python Debugging Session",
  "metadata": {
    "project": "my-python-app",
    "tags": ["debugging", "python"]
  },
  "messages": [
    {
      "id": "71g3b4c5d6e7f8a9b0c1e3",
      "role": "user",
      "content": "I'm having an issue with my Python code",
      "timestamp": "2025-06-17T20:44:10.123Z"
    },
    {
      "id": "81h4c5d6e7f8a9b0c1f4",
      "role": "assistant",
      "content": "Let me help you debug that. What's the error you're seeing?",
      "timestamp": "2025-06-17T20:44:15.456Z"
    }
  ],
  "createdAt": "2025-06-17T20:43:22.123Z",
  "updatedAt": "2025-06-17T20:44:15.456Z"
}
```

**Error Response**:
- **Code**: 404 Not Found
- **Content**:
```json
{
  "error": "Not Found",
  "message": "Session not found"
}
```

### Update Session

Update session details.

- **URL**: `/:sessionId`
- **Method**: `PATCH`
- **Auth Required**: Yes (JWT)

**Headers**:
```
Authorization: Bearer [access_token]
Content-Type: application/json
```

**Request Body**:
```json
{
  "title": "Updated Session Title",
  "metadata": {
    "status": "completed",
    "tags": ["debugging", "python", "resolved"]
  }
}
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "id": "61f2a3b4c5d6e7f8a9b0c1d2",
  "title": "Updated Session Title",
  "metadata": {
    "project": "my-python-app",
    "status": "completed",
    "tags": ["debugging", "python", "resolved"]
  },
  "updatedAt": "2025-06-17T20:50:22.123Z"
}
```

**Error Response**:
- **Code**: 404 Not Found
- **Content**:
```json
{
  "error": "Not Found",
  "message": "Session not found"
}
```

### Delete Session

Delete a session.

- **URL**: `/:sessionId`
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
  "message": "Session deleted successfully"
}
```

**Error Response**:
- **Code**: 404 Not Found
- **Content**:
```json
{
  "error": "Not Found",
  "message": "Session not found"
}
```

### List Sessions

List all sessions for a user.

- **URL**: `/`
- **Method**: `GET`
- **Auth Required**: Yes (JWT)

**Query Parameters**:
- `userId` (string, required): The user ID to get sessions for
- `limit` (number, optional): Maximum number of sessions to return (default: 20)
- `skip` (number, optional): Number of sessions to skip (for pagination, default: 0)
- `sort` (string, optional): Sort order, either "asc" or "desc" by creation date (default: "desc")

**Headers**:
```
Authorization: Bearer [access_token]
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "sessions": [
    {
      "id": "61f2a3b4c5d6e7f8a9b0c1d2",
      "title": "Updated Session Title",
      "metadata": {
        "project": "my-python-app",
        "status": "completed"
      },
      "messageCount": 10,
      "createdAt": "2025-06-17T20:43:22.123Z",
      "updatedAt": "2025-06-17T20:50:22.123Z"
    },
    {
      "id": "91i5d6e7f8a9b0c1g5h6",
      "title": "JavaScript Refactoring",
      "metadata": {
        "project": "web-frontend"
      },
      "messageCount": 25,
      "createdAt": "2025-06-16T15:32:11.789Z",
      "updatedAt": "2025-06-16T16:10:43.456Z"
    }
  ],
  "total": 2,
  "limit": 20,
  "skip": 0
}
```

### Add Message to Session

Add a new message to a session.

- **URL**: `/:sessionId/messages`
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
  "role": "user",
  "content": "How do I fix this IndexError?",
  "metadata": {
    "codeContext": {
      "file": "app.py",
      "line": 25
    }
  }
}
```

**Success Response**:
- **Code**: 201 Created
- **Content**:
```json
{
  "id": "a2j6e7f8a9b0c1h7i8",
  "role": "user",
  "content": "How do I fix this IndexError?",
  "metadata": {
    "codeContext": {
      "file": "app.py",
      "line": 25
    }
  },
  "timestamp": "2025-06-17T20:55:12.123Z"
}
```

**Error Response**:
- **Code**: 404 Not Found
- **Content**:
```json
{
  "error": "Not Found",
  "message": "Session not found"
}
```

### Get Messages from Session

Get all messages from a session.

- **URL**: `/:sessionId/messages`
- **Method**: `GET`
- **Auth Required**: Yes (JWT)

**Query Parameters**:
- `limit` (number, optional): Maximum number of messages to return (default: 50)
- `before` (string, optional): Return messages before this message ID (for pagination)
- `after` (string, optional): Return messages after this message ID (for pagination)

**Headers**:
```
Authorization: Bearer [access_token]
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "messages": [
    {
      "id": "71g3b4c5d6e7f8a9b0c1e3",
      "role": "user",
      "content": "I'm having an issue with my Python code",
      "timestamp": "2025-06-17T20:44:10.123Z"
    },
    {
      "id": "81h4c5d6e7f8a9b0c1f4",
      "role": "assistant",
      "content": "Let me help you debug that. What's the error you're seeing?",
      "timestamp": "2025-06-17T20:44:15.456Z"
    },
    {
      "id": "a2j6e7f8a9b0c1h7i8",
      "role": "user",
      "content": "How do I fix this IndexError?",
      "metadata": {
        "codeContext": {
          "file": "app.py",
          "line": 25
        }
      },
      "timestamp": "2025-06-17T20:55:12.123Z"
    }
  ],
  "total": 3,
  "hasMore": false
}
```

### Delete Message

Delete a specific message from a session.

- **URL**: `/:sessionId/messages/:messageId`
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
  "message": "Message deleted successfully"
}
```

**Error Response**:
- **Code**: 404 Not Found
- **Content**:
```json
{
  "error": "Not Found",
  "message": "Message not found"
}
```

### Real-Time Session Streaming

Connect to a WebSocket to receive real-time session updates.

- **URL**: `/live/:sessionId`
- **Method**: `WebSocket`
- **Auth Required**: Yes (JWT as query parameter)

**WebSocket Connection**:
```
ws://localhost:8080/api/sessions/live/61f2a3b4c5d6e7f8a9b0c1d2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Server Messages**:
```json
{
  "type": "message_added",
  "data": {
    "id": "a2j6e7f8a9b0c1h7i8",
    "role": "assistant",
    "content": "To fix the IndexError, you need to check if the index is within bounds before accessing the list.",
    "timestamp": "2025-06-17T20:56:30.123Z"
  }
}
```

```json
{
  "type": "message_deleted",
  "data": {
    "messageId": "71g3b4c5d6e7f8a9b0c1e3"
  }
}
```

```json
{
  "type": "session_updated",
  "data": {
    "title": "Updated Session Title",
    "metadata": {
      "status": "in_progress"
    }
  }
}
```

```json
{
  "type": "typing_indicator",
  "data": {
    "userId": "user123",
    "status": "typing"
  }
}
```

**Client Messages**:
```json
{
  "type": "typing_indicator",
  "status": "typing"
}
```

```json
{
  "type": "typing_indicator",
  "status": "idle"
}
```

```json
{
  "type": "presence",
  "status": "active"
}
```

### Share Session

Share a session with another user.

- **URL**: `/:sessionId/share`
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
  "targetUserId": "user456",
  "permissions": ["read", "write"],
  "expiresAt": "2025-07-17T20:43:22.123Z"
}
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "success": true,
  "shareId": "share_abcd1234",
  "sessionId": "61f2a3b4c5d6e7f8a9b0c1d2",
  "targetUserId": "user456",
  "permissions": ["read", "write"],
  "expiresAt": "2025-07-17T20:43:22.123Z"
}
```

### List Shared Sessions

List all sessions shared with the current user.

- **URL**: `/shared`
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
  "sharedSessions": [
    {
      "shareId": "share_efgh5678",
      "sessionId": "91i5d6e7f8a9b0c1g5h6",
      "title": "JavaScript Refactoring",
      "sharedBy": {
        "userId": "user789",
        "username": "john.doe"
      },
      "permissions": ["read"],
      "sharedAt": "2025-06-15T10:30:22.123Z",
      "expiresAt": "2025-07-15T10:30:22.123Z",
      "lastAccessed": "2025-06-16T14:25:10.456Z"
    }
  ]
}
```

### Revoke Session Share

Revoke access to a shared session.

- **URL**: `/:sessionId/share/:shareId`
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
  "message": "Session share revoked successfully"
}
```

### Add File Context to Message

Add a file context reference to a message.

- **URL**: `/:sessionId/messages/:messageId/context`
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
  "type": "file",
  "data": {
    "path": "/home/user/project/app.py",
    "lineStart": 24,
    "lineEnd": 30,
    "content": "def process_item(items, index):\n    # Process the item at the given index\n    return items[index]\n\n# Usage\nresult = process_item(my_list, 10)"
  }
}
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "success": true,
  "messageId": "a2j6e7f8a9b0c1h7i8",
  "contextId": "ctx_12345",
  "type": "file"
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
  "service": "session-service"
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

### Create a new session (curl)

```bash
curl -X POST http://localhost:8080/api/sessions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{"userId":"user123","title":"Test Session"}'
```

### List user sessions (curl)

```bash
curl "http://localhost:8080/api/sessions?userId=user123" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Add message to session (curl)

```bash
curl -X POST http://localhost:8080/api/sessions/61f2a3b4c5d6e7f8a9b0c1d2/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{"role":"user","content":"Hello world"}'
```

### Windows CMD Example

```cmd
curl -X POST http://localhost:8080/api/sessions -H "Content-Type: application/json" -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." -d "{\"userId\":\"user123\",\"title\":\"Test Session\"}"
```

### PowerShell Example

```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/sessions" -Method POST -ContentType "application/json" -Headers @{"Authorization"="Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."} -Body '{"userId":"user123","title":"Test Session"}'
```

### Share a session (curl)

```bash
curl -X POST http://localhost:8080/api/sessions/61f2a3b4c5d6e7f8a9b0c1d2/share \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{"targetUserId":"user456","permissions":["read","write"]}'
```

### Add file context to message (curl)

```bash
curl -X POST http://localhost:8080/api/sessions/61f2a3b4c5d6e7f8a9b0c1d2/messages/a2j6e7f8a9b0c1h7i8/context \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "type": "file",
    "data": {
      "path": "/home/user/project/app.py",
      "lineStart": 24,
      "lineEnd": 30,
      "content": "def process_item(items, index):\\n    # Process the item at the given index\\n    return items[index]\\n\\n# Usage\\nresult = process_item(my_list, 10)"
    }
  }'
```

### WebSocket Client Example (JavaScript)

```javascript
// Connect to session WebSocket
const socket = new WebSocket(`ws://localhost:8080/api/sessions/live/61f2a3b4c5d6e7f8a9b0c1d2?token=${jwtToken}`);

socket.onopen = () => {
  console.log('Connected to session');
  
  // Send typing indicator
  socket.send(JSON.stringify({
    type: 'typing_indicator',
    status: 'typing'
  }));
  
  // Send presence
  socket.send(JSON.stringify({
    type: 'presence',
    status: 'active'
  }));
};

socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'message_added':
      console.log('New message:', message.data);
      // Update UI with new message
      displayMessage(message.data);
      break;
    
    case 'message_deleted':
      console.log('Message deleted:', message.data.messageId);
      // Remove message from UI
      removeMessage(message.data.messageId);
      break;
    
    case 'session_updated':
      console.log('Session updated:', message.data);
      // Update session information in UI
      updateSessionInfo(message.data);
      break;
    
    case 'typing_indicator':
      console.log('User typing status:', message.data);
      // Show typing indicator in UI
      showTypingIndicator(message.data.userId, message.data.status);
      break;
  }
};

socket.onclose = () => {
  console.log('Disconnected from session');
};
```