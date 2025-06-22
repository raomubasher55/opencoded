#!/bin/bash

# Terminal colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}OpenCode Services Health Check${NC}"
echo "==========================="
echo ""

# Check MongoDB
echo -e "${YELLOW}Checking MongoDB...${NC}"
if which mongosh > /dev/null; then
  if mongosh --eval "db.serverStatus()" --quiet | grep -q "ok"; then
    echo -e "${GREEN}✓ MongoDB is running${NC}"
  else
    echo -e "${RED}✗ MongoDB is not running${NC}"
    echo "  Try starting MongoDB with: mongod --fork --logpath /var/log/mongodb/mongod.log"
  fi
else
  echo -e "${YELLOW}? MongoDB client (mongosh) not found, skipping check${NC}"
fi
echo ""

# Function to check service health
check_service() {
  local name=$1
  local url=$2
  echo -e "${YELLOW}Checking $name...${NC}"
  
  # Try to connect with curl
  if curl -s --connect-timeout 2 "$url" > /dev/null; then
    echo -e "${GREEN}✓ $name is reachable at $url${NC}"
    local health_status=$(curl -s "$url"/health | grep -o '"status":"[^"]*"' | cut -d':' -f2 | tr -d '"')
    if [ ! -z "$health_status" ]; then
      echo -e "  Health status: $health_status"
    fi
  else
    echo -e "${RED}✗ $name is not reachable at $url${NC}"
    echo -e "  Trying to check port..."
    local port=$(echo $url | sed -E 's/.*:([0-9]+).*/\1/')
    if [ ! -z "$port" ]; then
      if nc -z localhost $port 2>/dev/null; then
        echo -e "  ${GREEN}✓ Port $port is open${NC}"
      else
        echo -e "  ${RED}✗ Port $port is closed or service is not running${NC}"
      fi
    fi
  fi
  echo ""
}

# Check each service
check_service "API Gateway" "http://localhost:8080"
check_service "Auth Service" "http://localhost:3003"
check_service "File Service" "http://localhost:4001"
check_service "LLM Service" "http://localhost:4002"
check_service "Tools Service" "http://localhost:4003"
check_service "Session Service" "http://localhost:4004"

echo -e "${YELLOW}Testing Proxy Routes${NC}"
echo "===================="
echo ""

# Function to test proxy route
test_proxy() {
  local name=$1
  local url=$2
  echo -e "${YELLOW}Testing $name proxy...${NC}"
  
  if curl -s --connect-timeout 2 "$url" > /dev/null; then
    echo -e "${GREEN}✓ Proxy route $url is working${NC}"
    local response=$(curl -s "$url")
    echo -e "  Response: ${response:0:50}..."
  else
    echo -e "${RED}✗ Proxy route $url is not working${NC}"
  fi
  echo ""
}

# Test proxy routes
test_proxy "Auth Service" "http://localhost:8080/api/auth/health"
test_proxy "File Service" "http://localhost:8080/api/files/health"
test_proxy "LLM Service" "http://localhost:8080/api/llm/health"
test_proxy "Tools Service" "http://localhost:8080/api/tools/health"
test_proxy "Session Service" "http://localhost:8080/api/sessions/health"

echo -e "${YELLOW}DNS Resolution Test${NC}"
echo "==================="
echo ""

# Test DNS resolution
echo -e "${YELLOW}Testing DNS resolution for service hosts...${NC}"
for host in "localhost" "auth-service" "file-service" "llm-service" "tools-service" "session-service"; do
  echo -n "Resolving $host: "
  if host $host > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Resolvable${NC}"
    host $host | grep "has address" | head -1
  else
    echo -e "${RED}✗ Not resolvable${NC}"
  fi
done