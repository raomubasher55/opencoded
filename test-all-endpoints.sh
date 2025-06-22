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
echo -e "${BLUE}OpenCode Microservices API Testing Suite${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""

# Make all test scripts executable
echo -e "${YELLOW}Making all test scripts executable...${NC}"
find "$BASE_DIR/services" -name "test-endpoints.sh" -exec chmod +x {} \;
echo -e "${GREEN}Done!${NC}"
echo ""

# Function to run a test script
run_test_script() {
  local service="$1"
  local script_path="$2"
  
  echo -e "${BLUE}=============================================${NC}"
  echo -e "${BLUE}Testing $service${NC}"
  echo -e "${BLUE}=============================================${NC}"
  
  if [ -f "$script_path" ]; then
    # Run the test script
    "$script_path"
    
    echo ""
    echo -e "${GREEN}Completed testing $service${NC}"
    echo ""
  else
    echo -e "${RED}Test script for $service not found at: $script_path${NC}"
    echo ""
  fi
}

# Ask user which services to test
echo -e "${YELLOW}Which services would you like to test?${NC}"
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
    # Test all services
    run_test_script "API Gateway" "$BASE_DIR/services/api-gateway/test-endpoints.sh"
    run_test_script "Auth Service" "$BASE_DIR/services/auth-service/test-endpoints.sh"
    run_test_script "File Service" "$BASE_DIR/services/file-service/test-endpoints.sh"
    run_test_script "LLM Service" "$BASE_DIR/services/llm-service/test-endpoints.sh"
    run_test_script "Session Service" "$BASE_DIR/services/session-service/test-endpoints.sh"
    run_test_script "Tools Service" "$BASE_DIR/services/tools-service/test-endpoints.sh"
    ;;
  2)
    run_test_script "API Gateway" "$BASE_DIR/services/api-gateway/test-endpoints.sh"
    ;;
  3)
    run_test_script "Auth Service" "$BASE_DIR/services/auth-service/test-endpoints.sh"
    ;;
  4)
    run_test_script "File Service" "$BASE_DIR/services/file-service/test-endpoints.sh"
    ;;
  5)
    run_test_script "LLM Service" "$BASE_DIR/services/llm-service/test-endpoints.sh"
    ;;
  6)
    run_test_script "Session Service" "$BASE_DIR/services/session-service/test-endpoints.sh"
    ;;
  7)
    run_test_script "Tools Service" "$BASE_DIR/services/tools-service/test-endpoints.sh"
    ;;
  *)
    echo -e "${RED}Invalid choice. Exiting.${NC}"
    exit 1
    ;;
esac

echo -e "${BLUE}=============================================${NC}"
echo -e "${BLUE}All tests completed!${NC}"
echo -e "${BLUE}=============================================${NC}"
echo ""
echo -e "${YELLOW}NOTE:${NC} Some tests may have failed if services weren't running or credentials weren't provided."
echo "Please review the API documentation for each service in the services/<service-name>/API.md files."