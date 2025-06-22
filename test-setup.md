# OpenCode Testing Setup Guide

This document provides steps to properly set up and test the OpenCode microservices.

## Prerequisites

Before running the tests, ensure you have the following installed:

1. Node.js (v14 or later)
2. MongoDB (v4.4 or later)
3. npm or yarn

## Setup Steps

### 1. Start MongoDB

MongoDB is required for the Auth and Session services.

```bash
# Start MongoDB (Linux/Mac)
mongod --dbpath=/var/lib/mongodb

# Windows (Command Prompt)
mongod --dbpath=C:\data\db
```

### 2. Build the Services

Ensure all services are built before testing:

```bash
# In the root directory
npm run build
```

### 3. Update Service Configurations

Each service has a `.env` file that needs to be configured:

#### API Gateway (.env)

```
NODE_ENV=development
PORT=8080
AUTH_SERVICE_URL=http://localhost:3003
FILE_SERVICE_URL=http://localhost:4001
LLM_SERVICE_URL=http://localhost:4002
SESSION_SERVICE_URL=http://localhost:4004
TOOLS_SERVICE_URL=http://localhost:4003
LOG_LEVEL=info
```

#### Auth Service (.env)

```
NODE_ENV=development
PORT=3003
JWT_SECRET=dev_secret_change_in_production
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
MONGODB_URI=mongodb://localhost:27017/opencode
LOG_LEVEL=info
```

#### Session Service (.env)

```
NODE_ENV=development
PORT=4004
MONGODB_URI=mongodb://localhost:27017/opencode
LOG_LEVEL=info
```

### 4. Start Each Service

Start each service in a separate terminal:

```bash
# Terminal 1: API Gateway
cd services/api-gateway
npm start

# Terminal 2: Auth Service
cd services/auth-service
npm start

# Terminal 3: File Service
cd services/file-service
npm start

# Terminal 4: LLM Service
cd services/llm-service
npm start

# Terminal 5: Session Service
cd services/session-service
npm start

# Terminal 6: Tools Service
cd services/tools-service
npm start
```

## Running Tests

Once all services are running, you can use the test scripts to verify functionality:

```bash
# Test all services
./test-all-endpoints.sh

# Test a specific service
./services/auth-service/test-endpoints.sh
```

### Common Test Issues

1. **MongoDB Connection Errors**: Ensure MongoDB is running and accessible at localhost:27017

2. **Empty Responses**: If you receive empty responses, check that the service is running and the URL is correct

3. **Connection Refused**: Check that the service is running on the expected port

4. **Authentication Errors**: Some endpoints require authentication with a valid JWT token. You'll need to:
   - Get a token by registering and logging in
   - Update the test scripts with your token

## Getting a Test Token

To get a test token for authenticated endpoints:

1. Register a user:
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'
```

2. Login to get a token:
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

3. Copy the accessToken from the response and add it to the test scripts