# Collaboration Service API Documentation

The Collaboration Service provides real-time collaborative features for the OpenCoded platform, including shared editing sessions, team workspaces, and multi-user chat.

## Base URL

When accessed through the API Gateway: `http://localhost:8080/api/collaboration`
Direct access: `http://localhost:4005/api`

## Authentication

All endpoints require authentication using a JWT token in the Authorization header:

```
Authorization: Bearer [access_token]
```

## Endpoints

### Sessions

#### Create Session

Create a new collaborative session.

- **URL**: `/sessions`
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
  "name": "Team Code Review",
  "description": "Reviewing PR #123",
  "visibility": "team",
  "teamId": "team123",
  "workspaceId": "workspace456"
}
```

**Success Response**:
- **Code**: 201 Created
- **Content**:
```json
{
  "id": "session789",
  "name": "Team Code Review",
  "description": "Reviewing PR #123",
  "visibility": "team",
  "teamId": "team123",
  "workspaceId": "workspace456",
  "participants": [
    {
      "userId": "user123",
      "username": "johndoe",
      "role": "owner",
      "joinedAt": "2025-06-18T21:20:15.123Z"
    }
  ],
  "createdBy": "user123",
  "createdAt": "2025-06-18T21:20:15.123Z",
  "updatedAt": "2025-06-18T21:20:15.123Z"
}
```

#### Get All Sessions

Get all sessions the current user has access to.

- **URL**: `/sessions`
- **Method**: `GET`
- **Auth Required**: Yes (JWT)

**Headers**:
```
Authorization: Bearer [access_token]
```

**Query Parameters**:
- `visibility` (string, optional): Filter by visibility (private, team, public)
- `teamId` (string, optional): Filter by team ID
- `active` (boolean, optional): Filter by active status
- `limit` (number, optional): Limit number of results
- `offset` (number, optional): Offset for pagination

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "sessions": [
    {
      "id": "session789",
      "name": "Team Code Review",
      "description": "Reviewing PR #123",
      "visibility": "team",
      "teamId": "team123",
      "participantsCount": 3,
      "createdBy": "user123",
      "createdAt": "2025-06-18T21:20:15.123Z"
    },
    {
      "id": "session456",
      "name": "Bug Fix Session",
      "description": "Fixing critical bug in auth module",
      "visibility": "private",
      "participantsCount": 2,
      "createdBy": "user123",
      "createdAt": "2025-06-17T14:30:22.456Z"
    }
  ],
  "total": 2,
  "limit": 10,
  "offset": 0
}
```

#### Get Session by ID

Get details of a specific session.

- **URL**: `/sessions/:id`
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
  "id": "session789",
  "name": "Team Code Review",
  "description": "Reviewing PR #123",
  "visibility": "team",
  "teamId": "team123",
  "workspaceId": "workspace456",
  "participants": [
    {
      "userId": "user123",
      "username": "johndoe",
      "role": "owner",
      "joinedAt": "2025-06-18T21:20:15.123Z"
    },
    {
      "userId": "user456",
      "username": "janedoe",
      "role": "editor",
      "joinedAt": "2025-06-18T21:25:30.789Z"
    }
  ],
  "activeParticipants": ["user123", "user456"],
  "createdBy": "user123",
  "createdAt": "2025-06-18T21:20:15.123Z",
  "updatedAt": "2025-06-18T21:20:15.123Z"
}
```

#### Join Session

Join an existing collaborative session.

- **URL**: `/sessions/:id/join`
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
  "role": "editor"
}
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "success": true,
  "message": "Successfully joined session",
  "role": "editor"
}
```

### Chat Messages

#### Get Session Messages

Get chat messages for a specific session.

- **URL**: `/chat/sessions/:sessionId/messages`
- **Method**: `GET`
- **Auth Required**: Yes (JWT)

**Headers**:
```
Authorization: Bearer [access_token]
```

**Query Parameters**:
- `limit` (number, optional): Limit number of results (default: 50)
- `before` (string, optional): Get messages before this timestamp
- `after` (string, optional): Get messages after this timestamp

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "messages": [
    {
      "id": "msg123",
      "sessionId": "session789",
      "userId": "user123",
      "username": "johndoe",
      "text": "Has anyone reviewed the auth module changes?",
      "timestamp": "2025-06-18T21:30:15.123Z"
    },
    {
      "id": "msg124",
      "sessionId": "session789",
      "userId": "user456",
      "username": "janedoe",
      "text": "Yes, I'm looking at them now",
      "timestamp": "2025-06-18T21:31:20.456Z"
    },
    {
      "id": "msg125",
      "sessionId": "session789",
      "userId": "user123",
      "username": "johndoe",
      "replyToId": "msg124",
      "text": "Great, let me know what you think",
      "timestamp": "2025-06-18T21:32:05.789Z"
    }
  ],
  "hasMore": false
}
```

#### Send Message

Send a new chat message to a session.

- **URL**: `/chat/sessions/:sessionId/messages`
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
  "text": "I found an issue with the error handling",
  "replyToId": "msg124",
  "codeSnippet": {
    "language": "typescript",
    "code": "function handleError(err) {\n  console.log(err);\n  // Missing return statement\n}",
    "fileName": "error-handler.ts"
  }
}
```

**Success Response**:
- **Code**: 201 Created
- **Content**:
```json
{
  "id": "msg126",
  "sessionId": "session789",
  "userId": "user123",
  "username": "johndoe",
  "text": "I found an issue with the error handling",
  "replyToId": "msg124",
  "codeSnippet": {
    "language": "typescript",
    "code": "function handleError(err) {\n  console.log(err);\n  // Missing return statement\n}",
    "fileName": "error-handler.ts"
  },
  "timestamp": "2025-06-18T21:35:45.123Z"
}
```

### Workspaces

#### Create Workspace

Create a new collaborative workspace.

- **URL**: `/workspaces`
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
  "name": "Project X",
  "description": "Main development workspace for Project X",
  "basePath": "/path/to/project",
  "teamId": "team123",
  "visibility": "team"
}
```

**Success Response**:
- **Code**: 201 Created
- **Content**:
```json
{
  "id": "workspace456",
  "name": "Project X",
  "description": "Main development workspace for Project X",
  "basePath": "/path/to/project",
  "teamId": "team123",
  "visibility": "team",
  "members": [
    {
      "userId": "user123",
      "username": "johndoe",
      "role": "owner",
      "addedAt": "2025-06-18T21:40:15.123Z"
    }
  ],
  "createdBy": "user123",
  "createdAt": "2025-06-18T21:40:15.123Z",
  "updatedAt": "2025-06-18T21:40:15.123Z"
}
```

## WebSocket Events

The WebSocket endpoint is available at `ws://localhost:4005/ws/collaboration?token=[access_token]&sessionId=[session_id]`.

### Connection Events

#### User Joined

Event fired when a user joins a session.

```json
{
  "type": "user-joined",
  "userId": "user456",
  "username": "janedoe",
  "timestamp": 1687094450123
}
```

#### User Left

Event fired when a user leaves a session.

```json
{
  "type": "user-left",
  "userId": "user456",
  "username": "janedoe",
  "timestamp": 1687094550456
}
```

### Editing Events

#### Cursor Update

Event for tracking user cursor positions.

```json
{
  "type": "cursor-update",
  "userId": "user123",
  "username": "johndoe",
  "fileId": "file456",
  "position": {
    "line": 42,
    "column": 15
  },
  "timestamp": 1687094650789
}
```

#### File Change

Event for file content changes.

```json
{
  "type": "file-change",
  "userId": "user123",
  "username": "johndoe",
  "fileId": "file456",
  "content": "Updated file content...",
  "version": 3,
  "operations": [
    { "p": ["text", 10], "i": "new " },
    { "p": ["text", 25], "d": "old" }
  ],
  "timestamp": 1687094750123
}
```

### Chat Events

#### Chat Message

Event for new chat messages.

```json
{
  "type": "chat-message",
  "id": "msg127",
  "userId": "user123",
  "username": "johndoe",
  "sessionId": "session789",
  "text": "Let's fix this bug together",
  "replyToId": null,
  "timestamp": 1687094850456
}
```

#### User Typing

Event indicating a user is typing.

```json
{
  "type": "user-typing",
  "userId": "user123",
  "username": "johndoe",
  "timestamp": 1687094950789
}
```

## Error Codes

- **400** - Bad Request: Invalid input data
- **401** - Unauthorized: Authentication failure
- **403** - Forbidden: Insufficient permissions
- **404** - Not Found: Resource not found
- **409** - Conflict: Resource already exists
- **500** - Internal Server Error: Unexpected server error

## Examples

### Create a Session (curl)

```bash
curl -X POST "http://localhost:8080/api/collaboration/sessions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "name": "Code Review Session",
    "description": "Review PR #456",
    "visibility": "team",
    "teamId": "team123"
  }'
```

### Connect to WebSocket (JavaScript)

```javascript
const socket = new WebSocket(
  `ws://localhost:4005/ws/collaboration?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...&sessionId=session789`
);

socket.onopen = () => {
  console.log('Connected to collaboration session');
};

socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received message:', message);
};

// Send a chat message
socket.send(JSON.stringify({
  type: 'chat-message',
  sessionId: 'session789',
  text: 'Hello team!'
}));
```