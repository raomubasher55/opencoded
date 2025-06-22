#!/bin/bash

# Text colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Gateway URL
GATEWAY_URL="http://localhost:8080"

echo -e "${YELLOW}API Gateway Test Script${NC}"
echo "========================="
echo "Gateway URL: $GATEWAY_URL"
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
  local http_status=$(curl -s -o /dev/null -w "%{http_code}" $url)
  
  if [ $status -eq 0 ]; then
    echo -e "${GREEN}✓ Request successful (HTTP Status: $http_status)${NC}"
    if [ -z "$response" ]; then
      echo "Response: <empty response>"
    else
      echo "Response: $response"
    fi
  else
    echo -e "${RED}✗ Request failed${NC}"
    echo "Response: $response"
  fi
  
  echo ""
  
  # Return the response for further processing
  echo "$response"
}

# Test Gateway health check
test_endpoint "Gateway Health Check" "GET" "$GATEWAY_URL/health" "" ""

# Test service health checks through Gateway
test_endpoint "Auth Service Health Check" "GET" "$GATEWAY_URL/api/auth/health" "" ""
test_endpoint "File Service Health Check" "GET" "$GATEWAY_URL/api/files/health" "" ""
test_endpoint "LLM Service Health Check" "GET" "$GATEWAY_URL/api/llm/health" "" ""
test_endpoint "Session Service Health Check" "GET" "$GATEWAY_URL/api/sessions/health" "" ""
test_endpoint "Tools Service Health Check" "GET" "$GATEWAY_URL/api/tools/health" "" ""

# Test rate limiting by making multiple requests
echo -e "${YELLOW}Testing: Rate Limiting${NC}"
echo "Making 5 quick requests to test rate limiting..."
echo ""

for i in {1..5}; do
  echo "Request $i:"
  status=$(curl -s -o /dev/null -w "%{http_code}" "$GATEWAY_URL/health")
  echo "Status: $status"
  if [ "$status" -eq 429 ]; then
    echo -e "${GREEN}✓ Rate limiting is working (received 429 Too Many Requests)${NC}"
  elif [ "$status" -eq 200 ]; then
    echo -e "${GREEN}✓ Request successful${NC}"
  elif [ "$status" -eq 0 ]; then
    echo -e "${RED}✗ Connection failed${NC}"
  else
    echo -e "${YELLOW}? Unexpected status code${NC}"
  fi
done

echo -e "${GREEN}✓ Rate limiting test completed${NC}"
echo ""

# Test CORS headers
echo -e "${YELLOW}Testing: CORS Headers${NC}"
echo "Testing if CORS headers are correctly set..."
echo ""

echo "Sending OPTIONS request with Origin header..."
cors_headers=$(curl -s -I -X OPTIONS -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST" "$GATEWAY_URL/health")
echo "$cors_headers"

if echo "$cors_headers" | grep -q "Access-Control-Allow-Origin"; then
  echo -e "${GREEN}✓ CORS headers present${NC}"
else
  echo -e "${YELLOW}? CORS headers not found or connection failed${NC}"
fi

echo -e "${GREEN}✓ CORS headers test completed${NC}"
echo ""

echo -e "${YELLOW}API Gateway Tests Completed${NC}"
echo "============================="
echo ""
echo -e "${YELLOW}Next Steps${NC}"
echo "1. Run individual service test scripts for detailed API testing"
echo "2. Check each service's API.md file for complete documentation"