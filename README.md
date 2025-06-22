# OpenCoded Microservices

CLI-based AI coding assistant with microservices architecture.

## Phase 1 Implementation

This repository contains the Phase 1 foundation implementation of the OpenCoded microservices project. This phase focuses on setting up the core infrastructure, service template, and CLI foundation.

## Project Structure

```
opencoded/
├── .github/             # GitHub Actions workflows
├── cli/                 # CLI implementation
├── packages/            # Shared packages
│   ├── shared-types/    # TypeScript type definitions
│   └── shared-utils/    # Shared utilities
├── services/            # Microservices
│   ├── api-gateway/     # API Gateway service
│   └── auth-service/    # Authentication service
├── docker-compose.yml   # Docker Compose configuration
├── package.json         # Root package.json
└── tsconfig.json        # TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm or yarn

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-username/opencoded-microservices.git
   cd opencoded-microservices
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the packages:
   ```
   npm run build
   ```

4. Install the CLI globally:
   ```
   cd cli
   npm install -g .
   ```

### Development

Start the services using Docker Compose:

```
docker-compose up
```

Run the CLI in development mode:

```
cd cli
npm run dev
```

### Using the CLI

Initialize a project:
```
opencoded init
```

Start a chat session:
```
opencoded chat
```

## Environment Variables

The project uses environment variables for configuration. Create a `.env` file in the root directory and service directories.

### Global Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment (development/production) | development |
| LOG_LEVEL | Logging level | info |

### CLI Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| OPENCODED_API_URL | API gateway URL | http://localhost:8080 |
| OPENCODED_API_KEY | API key for authentication | - |
| OPENCODED_LLM_PROVIDER | LLM provider (openai, anthropic, google, bedrock) | openai |
| OPENCODED_LLM_MODEL | Default model name | gpt-4 |
| OPENCODED_LLM_API_KEY | API key for LLM provider | - |

### Service Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Service port | Varies by service |
| API_GATEWAY_URL | URL for API gateway | http://localhost:8080 |
| AUTH_SERVICE_URL | URL for auth service | http://localhost:8081 |
| JWT_SECRET | Secret for JWT tokens | **Change in production** |
| DATABASE_URL | Database connection string | - |

**Note:** For security, never commit `.env` files to the repository. Use `.env.example` files instead.

## Phase 1 Features

- Project setup with TypeScript and ESLint
- Docker and Docker Compose configuration
- Basic microservice template
- Shared libraries structure
- API Gateway foundation
- Authentication service skeleton
- CLI command framework
- Project detection utility
- Configuration management

## Next Steps

Phase 2 will focus on implementing the core services and establishing the essential functionality for the AI coding assistant.

## License

MIT