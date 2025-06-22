#!/bin/bash

# Text colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Gateway and service URLs
GATEWAY_URL="http://localhost:8080"
DIRECT_URL="http://localhost:4001"
FILES_PATH="$GATEWAY_URL/api/files"
WATCH_PATH="$GATEWAY_URL/api/watch"
SEARCH_PATH="$GATEWAY_URL/api/search"

# Test data
TEST_DIR="/tmp/opencode-test-$(date +%s)"
TEST_FILE="$TEST_DIR/test-file.txt"
TEST_CONTENT="This is a test file created by the OpenCode test script.\nIt contains some test content for searching."
ACCESS_TOKEN="" # Set this to a valid token obtained from auth service

echo -e "${YELLOW}File Service API Test Script${NC}"
echo "==============================="
echo "Test directory: $TEST_DIR"
echo "Test file: $TEST_FILE"
echo "Gateway URL: $GATEWAY_URL"
echo "Direct URL: $DIRECT_URL"
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
test_endpoint "Health Check" "GET" "$DIRECT_URL/api/files/health" "" ""
test_endpoint "Health Check (via Gateway)" "GET" "$FILES_PATH/health" "" ""

# Test create directory endpoint
test_endpoint "Create Directory" "POST" "$FILES_PATH/directory" "{\"path\":\"$TEST_DIR\",\"recursive\":true}" "$AUTH_HEADER"

# Test write file endpoint
test_endpoint "Write File" "POST" "$FILES_PATH/write" "{\"path\":\"$TEST_FILE\",\"content\":\"$TEST_CONTENT\",\"createDirectory\":true}" "$AUTH_HEADER"

# Test list files endpoint
test_endpoint "List Files" "GET" "$FILES_PATH?path=$TEST_DIR" "" "$AUTH_HEADER"

# Test read file endpoint
test_endpoint "Read File" "GET" "$FILES_PATH/read?path=$TEST_FILE" "" "$AUTH_HEADER"

# Test search endpoint (assuming the file was created successfully)
test_endpoint "Search Files" "GET" "$SEARCH_PATH?query=test&path=$TEST_DIR&includeContent=true" "" "$AUTH_HEADER"

# Test watch endpoint (this will run for 5 seconds only)
echo -e "${YELLOW}Testing: Watch Files${NC}"
echo "URL: $WATCH_PATH?path=$TEST_DIR"
echo "Method: GET"
echo "This will run for 5 seconds only..."
echo ""
echo "Command: curl -N $AUTH_HEADER $WATCH_PATH?path=$TEST_DIR"

if [ ! -z "$ACCESS_TOKEN" ]; then
  # Run in background with timeout
  curl -N -H "Authorization: Bearer $ACCESS_TOKEN" "$WATCH_PATH?path=$TEST_DIR" & 
  CURL_PID=$!
  sleep 5
  kill $CURL_PID 2>/dev/null
  echo -e "${GREEN}✓ Watch test completed${NC}"
else
  echo -e "${RED}✗ Skipping watch test - no access token${NC}"
fi
echo ""

# Create a second test file to trigger watch events (if we were watching)
SECOND_FILE="$TEST_DIR/second-file.txt"
test_endpoint "Write Second File" "POST" "$FILES_PATH/write" "{\"path\":\"$SECOND_FILE\",\"content\":\"This is a second test file.\",\"createDirectory\":false}" "$AUTH_HEADER"

# Test delete file endpoint
test_endpoint "Delete File" "DELETE" "$FILES_PATH?path=$SECOND_FILE" "" "$AUTH_HEADER"

# Test delete directory endpoint (cleanup)
test_endpoint "Delete Directory" "DELETE" "$FILES_PATH?path=$TEST_DIR&recursive=true" "" "$AUTH_HEADER"

echo -e "${YELLOW}File Service API Tests Completed${NC}"
echo "=================================="