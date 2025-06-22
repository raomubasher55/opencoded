#!/bin/bash

# Script to test file service API endpoints for listing files in /mnt/d/clientsocket
# Created as part of the OpenCode project

API_HOST="http://localhost:4001"
API_GATEWAY="http://localhost:8080"
TARGET_DIR="/mnt/d/clientsocket"
TARGET_DIR_WIN="d:/clientsocket"
# Authentication is bypassed in code for testing
TOKEN=""

# Function to print colored output
print_colored() {
  echo -e "\033[1;34m[TEST]\033[0m $1"
}

print_colored "Listing files in: $TARGET_DIR"
print_colored "================================"

# Build auth header if token is available
AUTH_HEADER=""
if [ ! -z "$TOKEN" ]; then
    AUTH_HEADER="-H \"Authorization: Bearer $TOKEN\""
fi

# Check if the file service is running
print_colored "Checking if file service is running..."
HEALTH_RESPONSE=$(curl -s -X GET "$API_HOST/health")
echo "$HEALTH_RESPONSE"

if [[ $HEALTH_RESPONSE == *"UP"* ]]; then
  print_colored "File service is running ✓"
else
  print_colored "File service is not running. Starting service..."
  cd "$(dirname "$0")" && node dist/index.js > file_service.log 2>&1 &
  sleep 3
  
  # Check again
  HEALTH_RESPONSE=$(curl -s -X GET "$API_HOST/health")
  if [[ $HEALTH_RESPONSE == *"UP"* ]]; then
    print_colored "File service started successfully ✓"
  else
    print_colored "Failed to start file service. Please check logs."
    exit 1
  fi
fi

# Test endpoint 1: /api/files/operation (POST)
print_colored "Testing operation endpoint: POST ${API_HOST}/api/files/operation"
OPERATION_RESULT=$(curl -s -X POST -H "Content-Type: application/json" $AUTH_HEADER \
  "${API_HOST}/api/files/operation" \
  -d "{\"operation\":\"list\",\"path\":\"$TARGET_DIR\"}")

if [[ $OPERATION_RESULT == *"success\":true"* ]]; then
  print_colored "Operation endpoint successful ✓"
  print_colored "Files found:"
  echo "$OPERATION_RESULT" | grep -o '"name":"[^"]*"' | sed 's/"name":"//g' | sed 's/"//g' | sort | while read -r file; do
    echo "  - $file"
  done
else
  print_colored "Operation endpoint failed ✗"
  echo "$OPERATION_RESULT"
fi

# Test endpoint 2: /api/files/list/:path (GET) - with double slash
print_colored "Testing list endpoint with double slash: GET ${API_HOST}/api/files/list//${TARGET_DIR}"
LIST_RESULT=$(curl -s -X GET $AUTH_HEADER "${API_HOST}/api/files/list//${TARGET_DIR}")

if [[ $LIST_RESULT == *"success\":true"* ]]; then
  print_colored "List endpoint with double slash successful ✓"
  print_colored "Files found:"
  echo "$LIST_RESULT" | grep -o '"name":"[^"]*"' | sed 's/"name":"//g' | sed 's/"//g' | sort | while read -r file; do
    echo "  - $file"
  done
else
  print_colored "List endpoint failed ✗"
  echo "$LIST_RESULT"
fi

# Test reading a file
print_colored "Testing reading a file: GET ${API_HOST}/api/files/read//${TARGET_DIR}/Remember.md"
READ_RESULT=$(curl -s -X POST -H "Content-Type: application/json" $AUTH_HEADER \
  "${API_HOST}/api/files/operation" \
  -d "{\"operation\":\"read\",\"path\":\"$TARGET_DIR/Remember.md\"}")

if [[ $READ_RESULT == *"success\":true"* ]]; then
  print_colored "Read operation successful ✓"
  print_colored "File content preview:"
  echo "$READ_RESULT" | grep -o '"data":"[^"]*"' | sed 's/"data":"//g' | sed 's/"//g' | head -n 5
else
  print_colored "Read operation failed ✗"
  echo "$READ_RESULT"
fi

print_colored "Testing complete!"