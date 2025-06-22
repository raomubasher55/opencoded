#!/bin/bash

# Text colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Gateway and service URLs
GATEWAY_URL="http://localhost:8080/api/llm"
DIRECT_URL="http://localhost:4002/api/llm"

# Test data
ACCESS_TOKEN="" # Set this to a valid token obtained from auth service
OPENAI_PROVIDER="openai"
OPENAI_MODEL="gpt-3.5-turbo"
ANTHROPIC_PROVIDER="anthropic"
ANTHROPIC_MODEL="claude-3-sonnet"

echo -e "${YELLOW}LLM Service API Test Script${NC}"
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

# Test get providers endpoint
test_endpoint "Get Providers" "GET" "$GATEWAY_URL/providers" "" "$AUTH_HEADER"

# Test get current provider endpoint
test_endpoint "Get Current Provider" "GET" "$GATEWAY_URL/provider" "" "$AUTH_HEADER"

# Test set provider to OpenAI
test_endpoint "Set Provider to OpenAI" "POST" "$GATEWAY_URL/provider" "{\"provider\":\"$OPENAI_PROVIDER\",\"model\":\"$OPENAI_MODEL\",\"config\":{\"temperature\":0.7,\"maxTokens\":1024}}" "$AUTH_HEADER"

# Test text completion with OpenAI
test_endpoint "Text Completion (OpenAI)" "POST" "$GATEWAY_URL/complete" "{\"prompt\":\"Write a haiku about coding\",\"provider\":\"$OPENAI_PROVIDER\",\"model\":\"$OPENAI_MODEL\",\"temperature\":0.7,\"maxTokens\":100}" "$AUTH_HEADER"

# Test chat completion with OpenAI
test_endpoint "Chat Completion (OpenAI)" "POST" "$GATEWAY_URL/chat" "{\"messages\":[{\"role\":\"system\",\"content\":\"You are a helpful assistant.\"},{\"role\":\"user\",\"content\":\"What is the capital of France?\"}],\"provider\":\"$OPENAI_PROVIDER\",\"model\":\"$OPENAI_MODEL\",\"temperature\":0.7,\"maxTokens\":100}" "$AUTH_HEADER"

# Test set provider to Anthropic
test_endpoint "Set Provider to Anthropic" "POST" "$GATEWAY_URL/provider" "{\"provider\":\"$ANTHROPIC_PROVIDER\",\"model\":\"$ANTHROPIC_MODEL\",\"config\":{\"temperature\":0.7,\"maxTokens\":1024}}" "$AUTH_HEADER"

# Test chat completion with Anthropic
test_endpoint "Chat Completion (Anthropic)" "POST" "$GATEWAY_URL/chat" "{\"messages\":[{\"role\":\"user\",\"content\":\"What is the capital of Italy?\"}],\"provider\":\"$ANTHROPIC_PROVIDER\",\"model\":\"$ANTHROPIC_MODEL\",\"temperature\":0.7,\"maxTokens\":100}" "$AUTH_HEADER"

# Test tool/function calling
test_endpoint "Tool/Function Calling" "POST" "$GATEWAY_URL/tools" "{\"messages\":[{\"role\":\"system\",\"content\":\"You are a helpful assistant with access to tools.\"},{\"role\":\"user\",\"content\":\"What's the weather in New York?\"}],\"tools\":[{\"name\":\"getWeather\",\"description\":\"Get the current weather in a location\",\"parameters\":{\"type\":\"object\",\"required\":[\"location\"],\"properties\":{\"location\":{\"type\":\"string\",\"description\":\"The city and state, e.g. San Francisco, CA\"},\"unit\":{\"type\":\"string\",\"enum\":[\"celsius\",\"fahrenheit\"],\"description\":\"The unit of temperature\"}}}}],\"provider\":\"$OPENAI_PROVIDER\",\"model\":\"$OPENAI_MODEL\",\"temperature\":0.7,\"maxTokens\":100}" "$AUTH_HEADER"

echo -e "${YELLOW}LLM Service API Tests Completed${NC}"
echo "=================================="