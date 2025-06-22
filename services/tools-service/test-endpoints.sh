#!/bin/bash

# Text colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Gateway and service URLs
GATEWAY_URL="http://localhost:8080/api"
DIRECT_URL="http://localhost:4003/api"
TOOLS_PATH="$GATEWAY_URL/tools"
EXECUTIONS_PATH="$GATEWAY_URL/executions"
ANALYSIS_PATH="$GATEWAY_URL/analysis"

# Test data
ACCESS_TOKEN="" # Set this to a valid token obtained from auth service
TOOL_ID=""
EXECUTION_ID=""
ANALYSIS_ID=""

echo -e "${YELLOW}Tools Service API Test Script${NC}"
echo "==============================="
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
    
    # For certain endpoints, extract important data
    if [[ "$name" == "List Tools" ]]; then
      TOOL_ID=$(echo $response | grep -o '"id":"[^"]*"' | head -1 | cut -d':' -f2 | tr -d '"')
      echo "Extracted Tool ID: $TOOL_ID"
    elif [[ "$name" == "Execute Code" ]]; then
      EXECUTION_ID=$(echo $response | grep -o '"executionId":"[^"]*"' | cut -d':' -f2 | tr -d '"')
      echo "Extracted Execution ID: $EXECUTION_ID"
    elif [[ "$name" == "Analyze Code" ]]; then
      ANALYSIS_ID=$(echo $response | grep -o '"analysisId":"[^"]*"' | cut -d':' -f2 | tr -d '"')
      echo "Extracted Analysis ID: $ANALYSIS_ID"
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
test_endpoint "Health Check" "GET" "$DIRECT_URL/tools/health" "" ""
test_endpoint "Health Check (via Gateway)" "GET" "$TOOLS_PATH/health" "" ""

# Test list tools endpoint
list_tools_response=$(test_endpoint "List Tools" "GET" "$TOOLS_PATH" "" "$AUTH_HEADER")

# If we have a tool ID, test get tool details
if [ ! -z "$TOOL_ID" ]; then
  test_endpoint "Get Tool Details" "GET" "$TOOLS_PATH/$TOOL_ID" "" "$AUTH_HEADER"
  
  # Test apply tool endpoint
  test_endpoint "Apply Tool" "POST" "$TOOLS_PATH/$TOOL_ID/apply" "{\"language\":\"javascript\",\"code\":\"function add(a,b){return a+b}\",\"config\":{\"fix\":true,\"tabWidth\":2}}" "$AUTH_HEADER"
else
  echo -e "${RED}Skipping tool-specific tests - no tool ID available${NC}"
  echo ""
fi

# Test execute code endpoint
execute_response=$(test_endpoint "Execute Code" "POST" "$EXECUTIONS_PATH" "{\"language\":\"javascript\",\"code\":\"console.log('Hello, world!'); const x = 10; const y = 20; console.log(x + y);\",\"timeout\":5000}" "$AUTH_HEADER")

# If we have an execution ID, test get execution status
if [ ! -z "$EXECUTION_ID" ]; then
  test_endpoint "Get Execution Status" "GET" "$EXECUTIONS_PATH/$EXECUTION_ID" "" "$AUTH_HEADER"
else
  echo -e "${RED}Skipping execution status test - no execution ID available${NC}"
  echo ""
fi

# Test analyze code endpoint
analyze_response=$(test_endpoint "Analyze Code" "POST" "$ANALYSIS_PATH" "{\"language\":\"javascript\",\"code\":\"function factorial(n) { if (n <= 1) return 1; return n * factorial(n - 1); }\",\"analysisTypes\":[\"complexity\",\"security\",\"performance\"],\"detailed\":true}" "$AUTH_HEADER")

# If we have an analysis ID, test get analysis results
if [ ! -z "$ANALYSIS_ID" ]; then
  test_endpoint "Get Analysis Results" "GET" "$ANALYSIS_PATH/$ANALYSIS_ID" "" "$AUTH_HEADER"
else
  echo -e "${RED}Skipping analysis results test - no analysis ID available${NC}"
  echo ""
fi

echo -e "${YELLOW}Tools Service API Tests Completed${NC}"
echo "===================================="