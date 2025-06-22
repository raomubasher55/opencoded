#!/bin/bash
# Script to test health endpoints of all services

# Colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}OpenCode Phase 2 Health Check${NC}"
echo "==============================="

# Test API Gateway
echo -e "\n${BLUE}Testing API Gateway...${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health | grep -q "200"; then
    echo -e "${GREEN}API Gateway health check: SUCCESS${NC}"
else
    echo -e "${RED}API Gateway health check: FAILED${NC}"
fi

# Test Auth Service
echo -e "\n${BLUE}Testing Auth Service...${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/health | grep -q "200"; then
    echo -e "${GREEN}Auth Service health check: SUCCESS${NC}"
else
    echo -e "${RED}Auth Service health check: FAILED${NC}"
fi

# Test File Service
echo -e "\n${BLUE}Testing File Service...${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:4001/health | grep -q "200"; then
    echo -e "${GREEN}File Service health check: SUCCESS${NC}"
else
    echo -e "${RED}File Service health check: FAILED${NC}"
fi

# Test LLM Service
echo -e "\n${BLUE}Testing LLM Service...${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:4002/health | grep -q "200"; then
    echo -e "${GREEN}LLM Service health check: SUCCESS${NC}"
else
    echo -e "${RED}LLM Service health check: FAILED${NC}"
fi

# Test Session Service (using updated port 4004)
echo -e "\n${BLUE}Testing Session Service...${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:4004/health | grep -q "200"; then
    echo -e "${GREEN}Session Service health check: SUCCESS${NC}"
else
    echo -e "${RED}Session Service health check: FAILED${NC}"
fi

# Test Tools Service
echo -e "\n${BLUE}Testing Tools Service...${NC}"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:4003/health | grep -q "200"; then
    echo -e "${GREEN}Tools Service health check: SUCCESS${NC}"
else
    echo -e "${RED}Tools Service health check: FAILED${NC}"
fi

echo -e "\n${BLUE}Health Check Complete${NC}"
echo "==============================="