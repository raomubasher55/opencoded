# API Gateway Documentation

The API Gateway serves as a central entry point for all OpenCode microservices, providing routing, authentication, rate limiting, and CORS support.

## Base URL

`http://localhost:8080`

## Services Accessible Through the Gateway

The API Gateway routes requests to the following services:

| Service | Base Path | Description |
|---------|-----------|-------------|
| Auth Service | `/api/auth` | User authentication and authorization |
| File Service | `/api/files`, `/api/watch`, `/api/search` | File system operations |
| LLM Service | `/api/llm` | Large Language Model interactions |
| Session Service | `/api/sessions` | Session and conversation management |
| Tools Service | `/api/tools`, `/api/executions`, `/api/analysis` | Development tools and code execution |

## Gateway Features

### Health Check

Check if the API Gateway is running.

- **URL**: `/health`
- **Method**: `GET`
- **Auth Required**: No

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "status": "ok"
}
```

### Rate Limiting

The API Gateway implements rate limiting to prevent abuse:

- Rate limit: 100 requests per 15-minute window per IP address
- Applies to all `/api/` routes
- When rate limit is exceeded, returns 429 Too Many Requests status

### CORS Support

The API Gateway provides Cross-Origin Resource Sharing (CORS) support with the following configuration:

- Allowed origins: Configurable via `ALLOWED_ORIGINS` environment variable, defaults to:
  - `http://localhost:3000`
  - `http://localhost:3003`
  - `http://localhost:8080`
- Credentials: Allowed
- Methods: All standard HTTP methods are allowed

### Security Headers

The API Gateway adds security headers via Helmet middleware, including:

- Content-Security-Policy
- X-XSS-Protection
- X-Content-Type-Options
- X-Frame-Options
- Strict-Transport-Security

## Service-Specific Endpoints

For detailed information about the endpoints available through each service, please refer to the API documentation for the specific service:

- [Auth Service API Documentation](/services/auth-service/API.md)
- [File Service API Documentation](/services/file-service/API.md)
- [LLM Service API Documentation](/services/llm-service/API.md)
- [Session Service API Documentation](/services/session-service/API.md)
- [Tools Service API Documentation](/services/tools-service/API.md)

## Error Handling

### Common Error Responses

- **400 Bad Request**: Invalid input or request
- **401 Unauthorized**: Authentication required or failed
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource or endpoint not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Unexpected server error

### Error Response Format

```json
{
  "error": "Error Type",
  "message": "Detailed error message",
  "statusCode": 400
}
```

## Authentication

For endpoints that require authentication, include a JWT token in the Authorization header:

```
Authorization: Bearer [access_token]
```

To obtain an access token, use the Auth Service's login endpoint:

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

## Examples

### Accessing the Auth Service through the Gateway

```bash
# Register a new user
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Accessing the File Service through the Gateway

```bash
# List files
curl "http://localhost:8080/api/files?path=/path/to/directory" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Accessing the LLM Service through the Gateway

```bash
# Chat completion
curl -X POST http://localhost:8080/api/llm/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{"messages":[{"role":"user","content":"Hello, who are you?"}],"provider":"anthropic"}'
```

### Windows CMD Examples

```cmd
curl -X POST http://localhost:8080/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"testuser\",\"email\":\"test@example.com\",\"password\":\"password123\"}"
```

### PowerShell Examples

```powershell
Invoke-WebRequest -Uri "http://localhost:8080/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"test@example.com","password":"password123"}'
```

## Environment Variables

The API Gateway can be configured using the following environment variables:

| Variable | Description | Default Value |
|----------|-------------|---------------|
| PORT | Port on which the gateway listens | 8080 |
| AUTH_SERVICE_URL | URL of the Auth Service | http://localhost:3003 |
| FILE_SERVICE_URL | URL of the File Service | http://localhost:4001 |
| LLM_SERVICE_URL | URL of the LLM Service | http://localhost:4002 |
| TOOLS_SERVICE_URL | URL of the Tools Service | http://localhost:4003 |
| SESSION_SERVICE_URL | URL of the Session Service | http://localhost:4004 |
| ALLOWED_ORIGINS | Comma-separated list of allowed CORS origins | http://localhost:3000,http://localhost:3003,http://localhost:8080 |
| LOG_LEVEL | Logging level | info |