#!/bin/bash

# Text colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Set the base directory
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}OpenCode Microservices Startup Script${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

# Check if MongoDB is running
echo -e "${YELLOW}Checking if MongoDB is running...${NC}"
if command -v mongosh &> /dev/null; then
  if mongosh --eval "db.serverStatus()" --quiet &> /dev/null; then
    echo -e "${GREEN}MongoDB is already running${NC}"
  else
    echo -e "${YELLOW}Starting MongoDB...${NC}"
    if [ -d "/var/lib/mongodb" ]; then
      mongod --dbpath=/var/lib/mongodb --fork --logpath=/var/log/mongodb/mongod.log
    else
      echo -e "${RED}MongoDB data directory not found. Please create /var/lib/mongodb or specify a different path.${NC}"
      echo -e "${YELLOW}Continuing without MongoDB, some services may fail.${NC}"
    fi
  fi
else
  echo -e "${YELLOW}MongoDB client not found. Continuing without MongoDB, some services may fail.${NC}"
fi
echo ""

# Function to start a service
start_service() {
  local service_name="$1"
  local service_dir="$2"
  local env_vars="$3"
  
  echo -e "${YELLOW}Starting $service_name...${NC}"
  if [ -d "$service_dir" ]; then
    cd "$service_dir"
    # Check if dist directory exists
    if [ ! -d "dist" ]; then
      echo -e "${YELLOW}Building $service_name...${NC}"
      npm run build
    fi
    
    # Start the service with environment variables
    if [ ! -z "$env_vars" ]; then
      echo -e "${GREEN}$service_name is starting with custom environment variables${NC}"
      $env_vars npm start &
    else
      echo -e "${GREEN}$service_name is starting${NC}"
      npm start &
    fi
    
    # Store the PID
    local service_pid=$!
    echo -e "${GREEN}$service_name started with PID: $service_pid${NC}"
    echo "$service_pid" > "$BASE_DIR/.$service_name.pid"
    cd "$BASE_DIR"
  else
    echo -e "${RED}$service_name directory not found: $service_dir${NC}"
  fi
  echo ""
}

# Ask user which services to start
echo -e "${YELLOW}Which services would you like to start?${NC}"
echo "1) All services"
echo "2) API Gateway"
echo "3) Auth Service"
echo "4) File Service"
echo "5) LLM Service"
echo "6) Session Service"
echo "7) Tools Service"
echo ""
read -p "Enter your choice (1-7): " choice

case $choice in
  1)
    # Start all services
    start_service "auth-service" "$BASE_DIR/services/auth-service" "MONGODB_URI=mongodb://localhost:27017/opencode PORT=3003"
    start_service "file-service" "$BASE_DIR/services/file-service" "PORT=4001"
    start_service "llm-service" "$BASE_DIR/services/llm-service" "PORT=4002"
    start_service "session-service" "$BASE_DIR/services/session-service" "MONGODB_URI=mongodb://localhost:27017/opencode PORT=4004"
    start_service "tools-service" "$BASE_DIR/services/tools-service" "PORT=4003"
    
    # Wait for services to start
    echo -e "${YELLOW}Waiting for services to start...${NC}"
    sleep 5
    
    # Start API Gateway last to ensure services are available
    start_service "api-gateway" "$BASE_DIR/services/api-gateway" "AUTH_SERVICE_URL=http://localhost:3003 FILE_SERVICE_URL=http://localhost:4001 LLM_SERVICE_URL=http://localhost:4002 SESSION_SERVICE_URL=http://localhost:4004 TOOLS_SERVICE_URL=http://localhost:4003 PORT=8080"
    ;;
  2)
    start_service "api-gateway" "$BASE_DIR/services/api-gateway" "AUTH_SERVICE_URL=http://localhost:3003 FILE_SERVICE_URL=http://localhost:4001 LLM_SERVICE_URL=http://localhost:4002 SESSION_SERVICE_URL=http://localhost:4004 TOOLS_SERVICE_URL=http://localhost:4003 PORT=8080"
    ;;
  3)
    start_service "auth-service" "$BASE_DIR/services/auth-service" "MONGODB_URI=mongodb://localhost:27017/opencode PORT=3003"
    ;;
  4)
    start_service "file-service" "$BASE_DIR/services/file-service" "PORT=4001"
    ;;
  5)
    start_service "llm-service" "$BASE_DIR/services/llm-service" "PORT=4002"
    ;;
  6)
    start_service "session-service" "$BASE_DIR/services/session-service" "MONGODB_URI=mongodb://localhost:27017/opencode PORT=4004"
    ;;
  7)
    start_service "tools-service" "$BASE_DIR/services/tools-service" "PORT=4003"
    ;;
  *)
    echo -e "${RED}Invalid choice. Exiting.${NC}"
    exit 1
    ;;
esac

echo -e "${BLUE}=============================================${NC}"
echo -e "${GREEN}Services have been started!${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "${YELLOW}To stop all services, run:${NC}"
echo "kill \$(cat $BASE_DIR/.*.pid)"
echo ""
echo -e "${YELLOW}To check if services are running:${NC}"
echo "ps aux | grep node"
echo ""
echo -e "${YELLOW}To test the API:${NC}"
echo "./test-all-endpoints.sh"