#!/bin/bash

# Text colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Gateway and service URLs
GATEWAY_URL="http://localhost:8080/api/auth"
DIRECT_URL="http://localhost:3003"

# Test data
USERNAME="testuser_$(date +%s)"
EMAIL="${USERNAME}@example.com"
PASSWORD="Password123!"
USER_ID=""
ACCESS_TOKEN=""
REFRESH_TOKEN=""
API_KEY=""

echo -e "${YELLOW}Auth Service API Test Script${NC}"
echo "==============================="
echo "Using username: $USERNAME"
echo "Using email: $EMAIL"
echo "Gateway URL: $GATEWAY_URL"
echo "Direct URL: $DIRECT_URL"
echo ""

# Function to test an endpoint
test_endpoint() {
  local name="$1"
  local method="$2"
  local url="$3"
  local data="$4"
  local headers="$5"
  
  echo -e "${YELLOW}Testing: $name${NC}"
  echo "URL: $url"
  echo "Method: $method"
  if [ ! -z "$data" ]; then
    echo "Data: $data"
  fi
  
  local cmd="curl -s -X $method"
  
  if [ ! -z "$data" ]; then
    cmd="$cmd -H 'Content-Type: application/json' -d '$data'"
  fi
  
  if [ ! -z "$headers" ]; then
    cmd="$cmd $headers"
  fi
  
  cmd="$cmd $url"
  
  echo "Command: $cmd"
  
  # Execute the command
  local response=$(eval $cmd)
  local status=$?
  
  if [ $status -eq 0 ]; then
    echo -e "${GREEN}✓ Request successful${NC}"
    if [ -z "$response" ]; then
      echo "Response: <empty response>"
    else
      echo "Response: $response"
    fi
    
    # For certain endpoints, extract important data
    if [[ "$name" == "Register User" ]]; then
      USER_ID=$(echo $response | grep -o '"id":"[^"]*"' | cut -d':' -f2 | tr -d '"')
      echo "Extracted User ID: $USER_ID"
    elif [[ "$name" == "Login" ]]; then
      ACCESS_TOKEN=$(echo $response | grep -o '"accessToken":"[^"]*"' | cut -d':' -f2 | tr -d '"')
      REFRESH_TOKEN=$(echo $response | grep -o '"refreshToken":"[^"]*"' | cut -d':' -f2 | tr -d '"')
      echo "Extracted Access Token: ${ACCESS_TOKEN:0:15}..."
      echo "Extracted Refresh Token: ${REFRESH_TOKEN:0:15}..."
    elif [[ "$name" == "Generate API Key" ]]; then
      API_KEY=$(echo $response | grep -o '"apiKey":"[^"]*"' | cut -d':' -f2 | tr -d '"')
      echo "Extracted API Key: ${API_KEY:0:15}..."
    fi
  else
    echo -e "${RED}✗ Request failed${NC}"
    echo "Response: $response"
  fi
  
  echo ""
  
  # Return the response for further processing
  echo "$response"
}

# Test health check endpoint
test_endpoint "Health Check" "GET" "$DIRECT_URL/health" "" ""
test_endpoint "Health Check (via Gateway)" "GET" "$GATEWAY_URL/health" "" ""

# Test register endpoint
register_response=$(test_endpoint "Register User" "POST" "$GATEWAY_URL/register" "{\"username\":\"$USERNAME\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" "")

# Test login endpoint
login_response=$(test_endpoint "Login" "POST" "$GATEWAY_URL/login" "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" "")

# Test refresh token endpoint
if [ ! -z "$REFRESH_TOKEN" ]; then
  test_endpoint "Refresh Token" "POST" "$GATEWAY_URL/refresh-token" "{\"refreshToken\":\"$REFRESH_TOKEN\"}" ""
else
  echo -e "${RED}Skipping refresh token test - no token available${NC}"
  echo ""
fi

# Test generate API key endpoint
if [ ! -z "$USER_ID" ] && [ ! -z "$ACCESS_TOKEN" ]; then
  test_endpoint "Generate API Key" "POST" "$GATEWAY_URL/users/$USER_ID/api-keys" "{}" "-H 'Authorization: Bearer $ACCESS_TOKEN'"
else
  echo -e "${RED}Skipping API key generation test - missing user ID or access token${NC}"
  echo ""
fi

# Test OAuth URLs (just checking that they exist, not actually following the OAuth flow)
test_endpoint "GitHub OAuth URL" "GET" "$GATEWAY_URL/github" "" ""
test_endpoint "Google OAuth URL" "GET" "$GATEWAY_URL/google" "" ""

echo -e "${YELLOW}Auth Service API Tests Completed${NC}"
echo "=================================="