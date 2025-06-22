# Collaboration Service

This service provides real-time collaborative features for the OpenCoded platform, including shared editing, team workspaces, and multi-user chat sessions.

## Key Features

- Real-time collaborative editing
- Multi-user chat and file sharing
- Cursor position tracking
- Team workspace management
- Commenting and annotation system
- Conflict resolution and version control integration

## API Endpoints

The collaboration service exposes the following API endpoints:

### HTTP/REST Endpoints

- **Base URL**: `http://localhost:4005/api/`
- **Health Check**: `http://localhost:4005/health`

### WebSocket Endpoint

- **Collaboration WebSocket**: `ws://localhost:4005/ws/collaboration`

## Authentication

All endpoints require authentication:

- REST endpoints use JWT token in the `Authorization` header
- WebSocket connections use a JWT token as a query parameter (`?token=YOUR_JWT_TOKEN`)

## WebSocket Event Types

### Connection Events

- `connect`: User has connected to the session
- `disconnect`: User has disconnected from the session
- `join-session`: User has joined a specific workspace session
- `leave-session`: User has left a specific workspace session

### Editing Events

- `cursor-update`: User cursor position has changed
- `file-change`: File content has changed
- `file-open`: User has opened a file
- `file-close`: User has closed a file

### Chat Events

- `chat-message`: New chat message in the session
- `user-typing`: User is typing a message
- `user-stopped-typing`: User stopped typing

### Workspace Events

- `workspace-update`: Workspace details have been updated
- `participant-update`: Participant information has changed
- `permission-change`: User permissions have changed

## Getting Started

1. **Installation**:
   ```bash
   cd services/collaboration-service
   npm install
   ```

2. **Configuration**:
   Copy `.env.example` to `.env` and update the values

3. **Run in development mode**:
   ```bash
   npm run dev
   ```

4. **Build and run in production**:
   ```bash
   npm run build
   npm start
   ```

## Example Usage

### Connect to a Collaboration Session

```javascript
const socket = new WebSocket(`ws://localhost:4005/ws/collaboration?token=${jwtToken}&sessionId=${sessionId}`);

socket.onopen = () => {
  console.log('Connected to collaboration session');
  
  // Join editing session for a specific file
  socket.send(JSON.stringify({
    type: 'join-file-edit',
    fileId: 'file123',
    username: 'user1'
  }));
};

socket.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'cursor-update':
      updateUserCursor(message.userId, message.position);
      break;
    case 'file-change':
      updateFileContent(message.fileId, message.content, message.version);
      break;
    case 'chat-message':
      displayChatMessage(message.userId, message.text, message.timestamp);
      break;
    // Handle other event types
  }
};

// Send cursor position update
function sendCursorPosition(position) {
  socket.send(JSON.stringify({
    type: 'cursor-update',
    fileId: 'file123',
    position
  }));
}

// Send file edit
function sendFileEdit(fileId, content) {
  socket.send(JSON.stringify({
    type: 'file-change',
    fileId,
    content,
    version: currentVersion + 1
  }));
}

// Send chat message
function sendChatMessage(text) {
  socket.send(JSON.stringify({
    type: 'chat-message',
    text,
    timestamp: Date.now()
  }));
}
```

## Architecture

This service uses:
- Socket.IO for WebSocket communication
- Redis for pub/sub message distribution
- MongoDB for persistent storage of session data
- JSON operational transformation for conflict resolution

## Integration with Other Services

- Authenticates users through the Auth Service
- Integrates with the Session Service for history tracking
- Communicates with the File Service for file operations
- Uses the LLM Service for AI assistance in collaborative sessions

## Operational Transformation

The service implements a JSON Operational Transformation (OT) algorithm to handle concurrent edits:

```javascript
// Apply an operation to a document
function applyOperation(doc, operation) {
  // Implementation of OT algorithm
}

// Transform an operation against another operation
function transformOperation(operation, otherOperation) {
  // Implementation of OT transformation
}
```