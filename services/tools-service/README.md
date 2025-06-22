# OpenCode Tools Service

This service provides code execution, analysis, and development tool capabilities for the OpenCode platform.

## Features

- Secure code execution in isolated sandboxes
- Code analysis for quality, security, and performance
- AST parsing and dependency analysis
- Tool management for registered development tools
- Support for multiple programming languages

## Prerequisites

- Node.js 18+
- npm or yarn
- Docker (optional, for container-based isolation)

## Installation

```bash
# Install dependencies
npm install

# Build the service
npm run build
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=4003
NODE_ENV=development

# Security
JWT_SECRET=your_secure_jwt_secret_here  # Replace with a secure random string in production

# Sandbox Configuration
SANDBOX_ENABLED=true
MAX_EXECUTION_TIME_MS=5000
MAX_MEMORY_MB=512

# Docker Settings (for container-based isolation)
DOCKER_SOCKET=/var/run/docker.sock

# Logging
LOG_LEVEL=info

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080

# Path for tool storage (if needed)
TOOLS_PATH=./tools
```

## Running the Service

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm run start
```

## API Documentation

Refer to [API.md](./API.md) for detailed API documentation.

## Testing

Run the test script to verify all endpoints are working correctly:

```bash
# Basic tests
./test-endpoints.sh

# Comprehensive tests
./test-endpoints-all.sh
```

Note: You'll need a valid JWT token to test authenticated endpoints. You can obtain one by logging in via the Auth Service.

## Docker Support

Build and run using Docker:

```bash
docker build -t opencode-tools-service .
docker run -p 4003:4003 -v /var/run/docker.sock:/var/run/docker.sock opencode-tools-service
```

## Security Considerations

The Tools Service executes code in isolated environments. There are two modes of isolation:

1. **VM2-based isolation**: Lightweight JavaScript sandboxing using the vm2 library.
2. **Container-based isolation**: Stronger isolation using Docker containers (requires Docker).

To ensure security:

- Never run this service as root
- Always set a strong JWT_SECRET
- In production, set SANDBOX_ENABLED=true and ensure Docker is properly configured
- Regularly update dependencies to patch security vulnerabilities
- Monitor resource usage to prevent DoS attacks

## License

This project is licensed under the MIT License - see the LICENSE file for details.