# MongoDB Integration for OpenCode

This document outlines the MongoDB integration implemented across the OpenCode microservices.

## Overview

MongoDB has been integrated into the following services:

1. **Auth Service** - User authentication and management
2. **Session Service** - User session management
3. **Collaboration Service** - Real-time collaboration features
4. **Tools Service** - Tools execution and management

## Integration Details

### 1. Database Configuration

Added database connection configuration to each service:

- `/services/auth-service/src/config/database.ts`
- `/services/session-service/src/config/database.ts`
- `/services/tools-service/src/config/database.ts`

Each service has proper connection management with:
- Connection pooling
- Error handling
- Reconnection logic
- Graceful shutdown

### 2. Environment Configuration

Updated `.env.example` files with MongoDB URIs:

- `MONGODB_URI=mongodb://localhost:27017/opencode-auth`
- `MONGODB_URI=mongodb://localhost:27017/opencode-session`
- `MONGODB_URI=mongodb://localhost:27017/opencode-tools`

For Docker deployment, configured URIs as:
- `MONGODB_URI=mongodb://mongodb:27017/opencode-[service-name]`

### 3. Docker Configuration

Updated `docker-compose.yml` to:
- Include MongoDB container
- Configure MongoDB volume for data persistence
- Set MongoDB environment variables for each service
- Establish service dependencies

### 4. Service Initialization

Updated service entry points to:
- Connect to MongoDB at startup
- Handle connection errors
- Implement graceful shutdown

### 5. MongoDB Models

Each service has its own models:
- **Auth Service**: User model
- **Session Service**: Session model
- **Collaboration Service**: Workspace, Comment, Review, Thread models
- **Tools Service**: Tool model

## Usage

The MongoDB instance can be accessed:

1. **In Docker**: Via the `mongodb` service on port 27017
2. **Local Development**: Via localhost:27017

## Database Structure

Each service has its own database to maintain separation of concerns:

- `opencode-auth` - Authentication data
- `opencode-session` - Session data
- `opencode-collaboration` - Collaboration data
- `opencode-tools` - Tools data

## Future Improvements

Potential enhancements to the current MongoDB integration:

1. Implement database migrations for schema changes
2. Add database indexing for performance optimization
3. Implement caching layer (Redis) for frequently accessed data
4. Add database monitoring and performance metrics
5. Implement connection pooling optimization based on load