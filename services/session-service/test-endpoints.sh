#!/bin/bash

# Text colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Gateway and service URLs
GATEWAY_URL="http://localhost:8080/api/sessions"
DIRECT_URL="http://localhost:4004/api/sessions"

# Test data
ACCESS_TOKEN="" # Set this to a valid token obtained from auth service
USER_ID="user_$(date +%s)" # Replace with actual user ID from auth service
SESSION_TITLE="Test Session $(date +%s)"
SESSION_ID=""
MESSAGE_ID=""

echo -e "${YELLOW}Session Service API Test Script${NC}"
echo "================================"
echo "Gateway URL: $GATEWAY_URL"
echo "Direct URL: $DIRECT_URL"
echo "User ID: $USER_ID"
echo "Session Title: $SESSION_TITLE"
echo ""

# Check if access token is provided
if [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${YELLOW}Warning: No access token provided. Many tests will fail.${NC}"
  echo -e "Get a token by running the auth service test script first, then edit this script to add the token."
  echo ""
fi

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
    echo "Response: $response"
    
    # For certain endpoints, extract important data
    if [[ "$name" == "Create Session" ]]; then
      SESSION_ID=$(echo $response | grep -o '"id":"[^"]*"' | cut -d':' -f2 | tr -d '"')
      echo "Extracted Session ID: $SESSION_ID"
    elif [[ "$name" == "Add Message to Session" ]]; then
      MESSAGE_ID=$(echo $response | grep -o '"id":"[^"]*"' | cut -d':' -f2 | tr -d '"')
      echo "Extracted Message ID: $MESSAGE_ID"
    fi
  else
    echo -e "${RED}✗ Request failed${NC}"
    echo "Response: $response"
  fi
  
  echo ""
  
  # Return the response for further processing
  echo "$response"
}

# Prepare auth header if token exists
AUTH_HEADER=""
if [ ! -z "$ACCESS_TOKEN" ]; then
  AUTH_HEADER="-H 'Authorization: Bearer $ACCESS_TOKEN'"
fi

# Test health check endpoint
test_endpoint "Health Check" "GET" "$DIRECT_URL/health" "" ""
test_endpoint "Health Check (via Gateway)" "GET" "$GATEWAY_URL/health" "" ""

# Test create session endpoint
create_response=$(test_endpoint "Create Session" "POST" "$GATEWAY_URL" "{\"userId\":\"$USER_ID\",\"title\":\"$SESSION_TITLE\",\"metadata\":{\"tags\":[\"test\",\"api\"]}}" "$AUTH_HEADER")

# If we have a session ID, continue with session-specific tests
if [ ! -z "$SESSION_ID" ]; then
  # Test get session endpoint
  test_endpoint "Get Session" "GET" "$GATEWAY_URL/$SESSION_ID" "" "$AUTH_HEADER"
  
  # Test update session endpoint
  test_endpoint "Update Session" "PATCH" "$GATEWAY_URL/$SESSION_ID" "{\"title\":\"Updated $SESSION_TITLE\",\"metadata\":{\"tags\":[\"test\",\"api\",\"updated\"],\"status\":\"in-progress\"}}" "$AUTH_HEADER"
  
  # Test add message to session endpoint
  add_message_response=$(test_endpoint "Add Message to Session" "POST" "$GATEWAY_URL/$SESSION_ID/messages" "{\"role\":\"user\",\"content\":\"This is a test message\",\"metadata\":{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")\"}}" "$AUTH_HEADER")
  
  # Test add assistant message to session
  test_endpoint "Add Assistant Message to Session" "POST" "$GATEWAY_URL/$SESSION_ID/messages" "{\"role\":\"assistant\",\"content\":\"This is a response to your test message\",\"metadata\":{\"timestamp\":\"$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")\"}}" "$AUTH_HEADER"
  
  # Test get messages from session endpoint
  test_endpoint "Get Messages from Session" "GET" "$GATEWAY_URL/$SESSION_ID/messages" "" "$AUTH_HEADER"
  
  # If we have a message ID, test delete message endpoint
  if [ ! -z "$MESSAGE_ID" ]; then
    test_endpoint "Delete Message" "DELETE" "$GATEWAY_URL/$SESSION_ID/messages/$MESSAGE_ID" "" "$AUTH_HEADER"
  else
    echo -e "${RED}Skipping delete message test - no message ID available${NC}"
    echo ""
  fi
  
  # Test list sessions endpoint
  test_endpoint "List Sessions" "GET" "$GATEWAY_URL?userId=$USER_ID" "" "$AUTH_HEADER"
  
  # Test delete session endpoint
  test_endpoint "Delete Session" "DELETE" "$GATEWAY_URL/$SESSION_ID" "" "$AUTH_HEADER"
else
  echo -e "${RED}Skipping session-specific tests - no session ID available${NC}"
  echo ""
  
  # Still try to list sessions
  test_endpoint "List Sessions" "GET" "$GATEWAY_URL?userId=$USER_ID" "" "$AUTH_HEADER"
fi

echo -e "${YELLOW}Session Service API Tests Completed${NC}"
echo "===================================="