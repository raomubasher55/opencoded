# OpenCoded Phase 4 Implementation

## Overview

Phase 4 of the OpenCoded platform introduces advanced collaboration features, real-time communication, and enhanced integrations. This phase focuses on enabling multiple users to work together in shared coding sessions.

## Key Features

1. **Collaborative Coding**
   - Real-time collaborative editing
   - Multi-user chat sessions
   - Cursor position tracking
   - Team workspaces

2. **Enhanced File Service**
   - Directory listing from CLI
   - File system API for collaborative access
   - Real-time file change notifications

3. **Collaboration Service**
   - WebSocket-based communication
   - Session management
   - Team workspace organization
   - Access control and permissions

## Getting Started

### Prerequisites

- Node.js 18 or later
- MongoDB
- Redis (for WebSocket scaling)
- Docker and Docker Compose (optional)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/opencode.git
   cd opencode
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the services using Docker**:
   ```bash
   docker-compose up
   ```

   Or start the services individually:
   ```bash
   # Start each service in a separate terminal
   cd services/auth-service && npm run dev
   cd services/file-service && npm run dev
   cd services/collaboration-service && npm run dev
   cd services/api-gateway && npm run dev
   ```

4. **Install the CLI**:
   ```bash
   cd cli
   npm run build
   npm link
   ```

## Using the CLI

### List Files

```bash
# List files in the current directory
opencoded list

# List files in a specific directory
opencoded list /path/to/directory
```

### Collaborative Coding

```bash
# Create a new collaborative session
opencoded collab --create --name "Code Review Session"

# Join an existing session
opencoded collab --session abc123

# Join as a read-only participant
opencoded collab --session abc123 --readonly
```

## Architecture

The Phase 4 architecture extends the previous phases with a new Collaboration Service:

```
┌────────────┐     ┌────────────────┐     ┌────────────────┐
│            │     │                │     │                │
│    CLI     │────▶│  API Gateway   │────▶│  Auth Service  │
│            │     │                │     │                │
└────────────┘     └────────────────┘     └────────────────┘
      │                     │
      │ WebSocket           │
      ▼                     ▼
┌────────────┐     ┌────────────────┐     ┌────────────────┐
│            │     │                │     │                │
│ Real-time  │◀───▶│  Collaboration│◀───▶│  Session       │
│ Server     │     │  Service       │     │  Service       │
└────────────┘     └────────────────┘     └────────────────┘
                           │                      │
                           ▼                      ▼
                   ┌────────────────┐     ┌────────────────┐
                   │                │     │                │
                   │  LLM Service   │     │  File Service  │
                   │                │     │                │
                   └────────────────┘     └────────────────┘
```

## New Services and Components

### Collaboration Service

The Collaboration Service manages real-time communication between users:

- **WebSocket Server**: Handles real-time events
- **Session Management**: Tracks active sessions and participants
- **Access Control**: Manages user permissions
- **Chat System**: Handles messaging between participants

### Enhanced CLI Commands

The CLI has been extended with new commands for collaboration:

- **list**: List files in directories through the File Service API
- **collab**: Start collaborative coding sessions

## Operational Transformation

For conflict resolution in collaborative editing, we've implemented a simplified version of Operational Transformation:

```javascript
// Apply operations to content
function applyOperations(content, operations) {
  // Apply each operation sequentially
  return operations.reduce((currentContent, op) => {
    if (op.insert) {
      // Insert text at position
      return currentContent.slice(0, op.position) + op.insert + currentContent.slice(op.position);
    }
    if (op.delete) {
      // Delete text at position
      return currentContent.slice(0, op.position) + currentContent.slice(op.position + op.delete);
    }
    return currentContent;
  }, content);
}
```

## WebSocket Protocol

The WebSocket protocol is used for real-time communication:

1. **Connect with Authentication**:
   ```javascript
   const socket = new WebSocket(`ws://localhost:4005/ws/collaboration?token=${jwt}&sessionId=${id}`);
   ```

2. **Message Types**:
   - `chat-message`: New chat message
   - `cursor-update`: User cursor position
   - `file-change`: File content changes
   - `user-joined`: User joined session
   - `user-left`: User left session

## Next Steps
- Create extension marketplace for custom tools
- Implement domain-specific ML model fine-tuning
- Enhance enterprise deployment capabilities