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

echo -e "${YELLOW}Tools Service API Test Script - Complete Version${NC}"
echo "========================================"
echo "Gateway URL: $GATEWAY_URL"
echo "Direct URL: $DIRECT_URL"
echo ""

# Check if access token is provided
if [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${YELLOW}Warning: No access token provided. Many tests will fail.${NC}"
  echo -e "Get a token by running the auth service test script first, then edit this script to add the token."
  echo -e "You can obtain a token by running: curl -X POST http://localhost:8080/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@example.com\",\"password\":\"adminpassword\"}'"
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

# === Health Check Tests ===
echo -e "${YELLOW}=== Health Check Tests ===${NC}"
test_endpoint "Health Check (Direct)" "GET" "$DIRECT_URL/health" "" ""
test_endpoint "Health Check (via Gateway)" "GET" "$TOOLS_PATH/health" "" ""

# === Tool Management Tests ===
echo -e "${YELLOW}=== Tool Management Tests ===${NC}"
# List all tools
list_tools_response=$(test_endpoint "List Tools" "GET" "$TOOLS_PATH" "" "$AUTH_HEADER")

# If we have a tool ID, test get tool details
if [ ! -z "$TOOL_ID" ]; then
  test_endpoint "Get Tool Details" "GET" "$TOOLS_PATH/$TOOL_ID" "" "$AUTH_HEADER"
  
  # Test tool creation (admin only)
  test_endpoint "Create Tool" "POST" "$TOOLS_PATH" "{\"name\":\"Test Linter\",\"description\":\"A test linting tool\",\"type\":\"execution\",\"version\":\"1.0.0\",\"permissionLevel\":\"user\",\"command\":\"lint\",\"parameters\":[{\"name\":\"code\",\"description\":\"Code to lint\",\"type\":\"string\",\"required\":true}],\"resourceLimits\":{\"maxExecutionTimeMs\":5000,\"maxMemoryMB\":100,\"networkAccess\":false,\"fileSystemAccess\":[]}}" "$AUTH_HEADER"
  
  # Test tool update (admin only)
  test_endpoint "Update Tool" "PUT" "$TOOLS_PATH/$TOOL_ID" "{\"description\":\"Updated description\",\"version\":\"1.0.1\"}" "$AUTH_HEADER"
  
  # Test apply tool endpoint
  test_endpoint "Apply Tool" "POST" "$TOOLS_PATH/$TOOL_ID/apply" "{\"language\":\"javascript\",\"code\":\"function add(a,b){return a+b}\",\"config\":{\"fix\":true,\"tabWidth\":2}}" "$AUTH_HEADER"
  
  # Test tool deletion (admin only) - COMMENT OUT TO PREVENT DELETION
  # test_endpoint "Delete Tool" "DELETE" "$TOOLS_PATH/$TOOL_ID" "" "$AUTH_HEADER"
else
  echo -e "${RED}Skipping tool-specific tests - no tool ID available${NC}"
  echo ""
fi

# === Code Execution Tests ===
echo -e "${YELLOW}=== Code Execution Tests ===${NC}"
# Execute JavaScript code
execute_js_response=$(test_endpoint "Execute JavaScript" "POST" "$EXECUTIONS_PATH" "{\"language\":\"javascript\",\"code\":\"console.log('Hello, world!'); const x = 10; const y = 20; console.log(x + y);\",\"timeout\":5000}" "$AUTH_HEADER")

# Execute Python code (if supported)
execute_py_response=$(test_endpoint "Execute Python" "POST" "$EXECUTIONS_PATH" "{\"language\":\"python\",\"code\":\"print('Hello, Python!')\nx = 15\\ny = 25\\nprint(f'Sum: {x + y}')\",\"timeout\":5000}" "$AUTH_HEADER")

# If we have an execution ID, test get execution status
if [ ! -z "$EXECUTION_ID" ]; then
  test_endpoint "Get Execution Status" "GET" "$EXECUTIONS_PATH/$EXECUTION_ID" "" "$AUTH_HEADER"
  
  # Test execution cancellation
  test_endpoint "Cancel Execution" "DELETE" "$EXECUTIONS_PATH/$EXECUTION_ID" "" "$AUTH_HEADER"
  
  # List all executions for current user
  test_endpoint "List User Executions" "GET" "$EXECUTIONS_PATH" "" "$AUTH_HEADER"
else
  echo -e "${RED}Skipping execution-specific tests - no execution ID available${NC}"
  echo ""
fi

# === Code Analysis Tests ===
echo -e "${YELLOW}=== Code Analysis Tests ===${NC}"
# Analyze code (general)
analyze_response=$(test_endpoint "Analyze Code" "POST" "$ANALYSIS_PATH" "{\"language\":\"javascript\",\"code\":\"function factorial(n) { if (n <= 1) return 1; return n * factorial(n - 1); }\",\"analysisTypes\":[\"complexity\",\"security\",\"performance\"],\"detailed\":true}" "$AUTH_HEADER")

# AST parsing
test_endpoint "Parse AST" "POST" "$ANALYSIS_PATH/ast" "{\"code\":\"function add(a, b) { return a + b; }\"}" "$AUTH_HEADER"

# Code quality analysis
test_endpoint "Analyze Code Quality" "POST" "$ANALYSIS_PATH/quality" "{\"code\":\"function longFunction() {\\n  let x = 1;\\n  x++;\\n  x++;\\n  x++;\\n  x++;\\n  x++;\\n  return x;\\n}\",\"language\":\"javascript\"}" "$AUTH_HEADER"

# Dependency analysis
test_endpoint "Analyze Dependencies" "POST" "$ANALYSIS_PATH/dependencies" "{\"code\":\"import express from 'express';\\nimport cors from 'cors';\\nimport fs from 'fs';\",\"language\":\"javascript\"}" "$AUTH_HEADER"

# Security scanning
test_endpoint "Security Scan" "POST" "$ANALYSIS_PATH/security" "{\"code\":\"const password = 'hardcoded123';\\neval('console.log(\"unsafe\")');\",\"language\":\"javascript\"}" "$AUTH_HEADER"

# If we have an analysis ID, test get analysis results
if [ ! -z "$ANALYSIS_ID" ]; then
  test_endpoint "Get Analysis Results" "GET" "$ANALYSIS_PATH/$ANALYSIS_ID" "" "$AUTH_HEADER"
else
  echo -e "${RED}Skipping analysis results test - no analysis ID available${NC}"
  echo ""
fi

echo -e "${YELLOW}Tools Service API Tests Completed${NC}"
echo "====================================="