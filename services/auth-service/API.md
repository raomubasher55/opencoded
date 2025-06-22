# Auth Service API Documentation

The Auth Service provides user authentication, registration, and authorization functionalities for the OpenCode platform. With Phase 3 enhancements, it now includes role-based access control, tiered subscription plans, and team management capabilities.

## Base URL

When accessed through the API Gateway: `http://localhost:8080/api/auth`  
Direct access: `http://localhost:3003`

## Endpoints

### User Registration

Register a new user in the system.

- **URL**: `/register`
- **Method**: `POST`
- **Auth Required**: No

**Request Body**:
```json
{
  "username": "exampleuser",
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Success Response**:
- **Code**: 201 Created
- **Content**:
```json
{
  "id": "60d21b4667d0d8992e610c85",
  "username": "exampleuser",
  "email": "user@example.com",
  "createdAt": "2025-06-17T20:43:22.123Z"
}
```

**Error Response**:
- **Code**: 400 Bad Request
- **Content**:
```json
{
  "error": "Validation Error",
  "message": "Email already in use"
}
```

### User Login

Authenticate a user and receive access tokens.

- **URL**: `/login`
- **Method**: `POST`
- **Auth Required**: No

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "60d21b4667d0d8992e610c85",
    "username": "exampleuser",
    "email": "user@example.com"
  }
}
```

**Error Response**:
- **Code**: 401 Unauthorized
- **Content**:
```json
{
  "error": "Authentication Error",
  "message": "Invalid email or password"
}
```

### Refresh Token

Obtain a new access token using a refresh token.

- **URL**: `/refresh-token`
- **Method**: `POST`
- **Auth Required**: No

**Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Response**:
- **Code**: 401 Unauthorized
- **Content**:
```json
{
  "error": "Token Error",
  "message": "Invalid or expired refresh token"
}
```

### Generate API Key

Generate a new API key for a user.

- **URL**: `/users/:userId/api-keys`
- **Method**: `POST`
- **Auth Required**: Yes (JWT)

**Headers**:
```
Authorization: Bearer [access_token]
```

**Success Response**:
- **Code**: 201 Created
- **Content**:
```json
{
  "apiKey": "ok_live_1a2b3c4d5e6f7g8h9i0j",
  "createdAt": "2025-06-17T20:43:22.123Z"
}
```

**Error Response**:
- **Code**: 401 Unauthorized
- **Content**:
```json
{
  "error": "Authentication Error",
  "message": "Invalid or expired access token"
}
```

### GitHub OAuth Login

Initiate GitHub OAuth flow.

- **URL**: `/github`
- **Method**: `GET`
- **Auth Required**: No

**Success Response**:
- Redirects to GitHub for authentication

### GitHub OAuth Callback

Callback URL for GitHub OAuth.

- **URL**: `/github/callback`
- **Method**: `GET`
- **Auth Required**: No

**Success Response**:
- **Code**: 302 Found
- Redirects to frontend with token

### Google OAuth Login

Initiate Google OAuth flow.

- **URL**: `/google`
- **Method**: `GET`
- **Auth Required**: No

**Success Response**:
- Redirects to Google for authentication

### Google OAuth Callback

Callback URL for Google OAuth.

- **URL**: `/google/callback`
- **Method**: `GET`
- **Auth Required**: No

**Success Response**:
- **Code**: 302 Found
- Redirects to frontend with token

### Get User Roles

Get the roles assigned to a user.

- **URL**: `/users/:userId/roles`
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
  "userId": "60d21b4667d0d8992e610c85",
  "roles": ["user", "admin"],
  "permissions": [
    "read:projects",
    "write:projects",
    "execute:code",
    "admin:users"
  ]
}
```

### Assign Role to User

Assign a role to a user (admin only).

- **URL**: `/users/:userId/roles`
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
  "role": "admin"
}
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "success": true,
  "userId": "60d21b4667d0d8992e610c85",
  "roles": ["user", "admin"]
}
```

**Error Response**:
- **Code**: 403 Forbidden
- **Content**:
```json
{
  "error": "Permission Denied",
  "message": "Insufficient permissions to assign roles"
}
```

### Subscribe to Plan

Subscribe a user to a specific plan.

- **URL**: `/users/:userId/subscriptions`
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
  "planId": "plan_professional",
  "paymentMethodId": "pm_card_visa"
}
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "subscriptionId": "sub_1234567890",
  "userId": "60d21b4667d0d8992e610c85",
  "planId": "plan_professional",
  "status": "active",
  "currentPeriodEnd": "2025-07-17T20:43:22.123Z",
  "features": {
    "executionMinutes": 500,
    "teamMembers": 10,
    "privateProjects": 20
  }
}
```

### Get User Subscription

Get the current subscription for a user.

- **URL**: `/users/:userId/subscriptions`
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
  "subscriptionId": "sub_1234567890",
  "userId": "60d21b4667d0d8992e610c85",
  "planId": "plan_professional",
  "status": "active",
  "currentPeriodStart": "2025-06-17T20:43:22.123Z",
  "currentPeriodEnd": "2025-07-17T20:43:22.123Z",
  "features": {
    "executionMinutes": 500,
    "teamMembers": 10,
    "privateProjects": 20
  },
  "usage": {
    "executionMinutesUsed": 120,
    "teamMembersActive": 5,
    "privateProjectsCreated": 8
  }
}
```

### List Available Plans

List all available subscription plans.

- **URL**: `/plans`
- **Method**: `GET`
- **Auth Required**: No

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "plans": [
    {
      "id": "plan_free",
      "name": "Free",
      "description": "Basic features for individual developers",
      "price": 0,
      "features": {
        "executionMinutes": 60,
        "teamMembers": 1,
        "privateProjects": 3
      }
    },
    {
      "id": "plan_starter",
      "name": "Starter",
      "description": "Enhanced features for serious developers",
      "price": 9.99,
      "features": {
        "executionMinutes": 200,
        "teamMembers": 3,
        "privateProjects": 10
      }
    },
    {
      "id": "plan_professional",
      "name": "Professional",
      "description": "Professional features for development teams",
      "price": 29.99,
      "features": {
        "executionMinutes": 500,
        "teamMembers": 10,
        "privateProjects": 20
      }
    },
    {
      "id": "plan_enterprise",
      "name": "Enterprise",
      "description": "Advanced features for large organizations",
      "price": 99.99,
      "features": {
        "executionMinutes": 2000,
        "teamMembers": 50,
        "privateProjects": 100
      }
    }
  ]
}
```

### Create Team

Create a new team.

- **URL**: `/teams`
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
  "name": "Engineering Team",
  "description": "Our core engineering team"
}
```

**Success Response**:
- **Code**: 201 Created
- **Content**:
```json
{
  "id": "team_abc123",
  "name": "Engineering Team",
  "description": "Our core engineering team",
  "ownerId": "60d21b4667d0d8992e610c85",
  "createdAt": "2025-06-17T20:43:22.123Z",
  "members": [
    {
      "userId": "60d21b4667d0d8992e610c85",
      "role": "owner",
      "addedAt": "2025-06-17T20:43:22.123Z"
    }
  ]
}
```

### Add User to Team

Add a user to a team.

- **URL**: `/teams/:teamId/members`
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
  "userId": "70e32c5778e1e9aa3f721d96",
  "role": "member"
}
```

**Success Response**:
- **Code**: 200 OK
- **Content**:
```json
{
  "success": true,
  "teamId": "team_abc123",
  "member": {
    "userId": "70e32c5778e1e9aa3f721d96",
    "role": "member",
    "addedAt": "2025-06-17T21:15:45.789Z"
  }
}
```

**Error Response**:
- **Code**: 403 Forbidden
- **Content**:
```json
{
  "error": "Permission Denied",
  "message": "You must be a team owner or admin to add members"
}
```

### List Team Members

List all members of a team.

- **URL**: `/teams/:teamId/members`
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
  "teamId": "team_abc123",
  "members": [
    {
      "userId": "60d21b4667d0d8992e610c85",
      "username": "exampleuser",
      "email": "user@example.com",
      "role": "owner",
      "addedAt": "2025-06-17T20:43:22.123Z"
    },
    {
      "userId": "70e32c5778e1e9aa3f721d96",
      "username": "teamuser",
      "email": "team@example.com",
      "role": "member",
      "addedAt": "2025-06-17T21:15:45.789Z"
    }
  ],
  "total": 2
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
  "service": "auth-service"
}
```

## Error Codes

- **400** - Bad Request: Invalid input data
- **401** - Unauthorized: Authentication failure
- **403** - Forbidden: Insufficient permissions
- **404** - Not Found: Resource not found
- **409** - Conflict: Resource already exists
- **500** - Internal Server Error: Unexpected server error

## Authentication

This service uses JWT (JSON Web Tokens) for authentication. 

To authenticate API requests, include the JWT token in the Authorization header:
```
Authorization: Bearer [access_token]
```

## Examples

### Register a new user (curl)

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'
```

### Login (curl)

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Windows CMD Example

```cmd
curl -X POST http://localhost:8080/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"testuser\",\"email\":\"test@example.com\",\"password\":\"password123\"}"
```

### PowerShell Example

```powershell
Invoke-WebRequest -Uri http://localhost:8080/api/auth/register -Method POST -ContentType "application/json" -Body '{"username":"testuser","email":"test@example.com","password":"password123"}'
```

### Get user roles (curl)

```bash
curl http://localhost:8080/api/auth/users/60d21b4667d0d8992e610c85/roles \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Assign role to user (curl)

```bash
curl -X POST http://localhost:8080/api/auth/users/70e32c5778e1e9aa3f721d96/roles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{"role":"admin"}'
```

### Subscribe to plan (curl)

```bash
curl -X POST http://localhost:8080/api/auth/users/60d21b4667d0d8992e610c85/subscriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "planId": "plan_professional",
    "paymentMethodId": "pm_card_visa"
  }'
```

### List available plans (curl)

```bash
curl http://localhost:8080/api/auth/plans
```

### Create team (curl)

```bash
curl -X POST http://localhost:8080/api/auth/teams \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "name": "Engineering Team",
    "description": "Our core engineering team"
  }'
```

### Add user to team (curl)

```bash
curl -X POST http://localhost:8080/api/auth/teams/team_abc123/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "userId": "70e32c5778e1e9aa3f721d96",
    "role": "member"
  }'
```