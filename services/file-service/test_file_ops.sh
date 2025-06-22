#!/bin/bash
# File Service Test Script
# This script tests basic file operations using the File Service API

# Configuration
API_HOST="http://localhost:4001"
API_GATEWAY="http://localhost:8080"
TEST_DIR="/tmp/opencode-test"
TEST_FILE="$TEST_DIR/test-file.txt"
TOKEN=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}OpenCode File Service Test Script${NC}"
echo "=================================="

# Function to handle API calls
call_api() {
    local method=$1
    local url=$2
    local data=$3
    local headers=()
    
    if [ ! -z "$TOKEN" ]; then
        headers+=("-H" "Authorization: Bearer $TOKEN")
    fi
    
    if [ "$method" == "POST" ] || [ "$method" == "PUT" ]; then
        headers+=("-H" "Content-Type: application/json")
        echo -e "Calling: ${YELLOW}$method $url${NC}"
        echo -e "Request: ${YELLOW}$data${NC}"
        response=$(curl -s -X $method "${headers[@]}" -d "$data" "$url")
    else
        echo -e "Calling: ${YELLOW}$method $url${NC}"
        response=$(curl -s -X $method "${headers[@]}" "$url")
    fi
    
    echo -e "Response: ${YELLOW}$response${NC}"
    echo ""
    
    # Check if response contains "error" or "success": false
    if [[ "$response" == *"\"error\""* ]] || [[ "$response" == *"\"success\":false"* ]]; then
        return 1
    else
        return 0
    fi
}

# Test 1: Check service health
echo -e "${GREEN}Test 1: Checking Service Health${NC}"
call_api "GET" "$API_HOST/health"
call_api "GET" "$API_GATEWAY/health"

# Test 2: Get login token (if needed)
if [ -z "$TOKEN" ]; then
    echo -e "${GREEN}Test 2: Getting Authentication Token${NC}"
    echo "Please enter credentials for login:"
    read -p "Email: " email
    read -p "Password: " -s password
    echo ""
    
    login_data="{\"email\":\"$email\",\"password\":\"$password\"}"
    login_response=$(curl -s -X POST -H "Content-Type: application/json" -d "$login_data" "$API_GATEWAY/api/auth/login")
    
    # Extract token from response
    TOKEN=$(echo $login_response | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
    
    if [ -z "$TOKEN" ]; then
        echo -e "${RED}Failed to get authentication token. Continuing without authentication.${NC}"
    else
        echo -e "${GREEN}Successfully obtained authentication token.${NC}"
    fi
    echo ""
fi

# Test 3: Create test directory
echo -e "${GREEN}Test 3: Creating Test Directory${NC}"
mkdir_data="{\"path\":\"$TEST_DIR\",\"recursive\":true}"

# Try direct service
call_api "POST" "$API_HOST/api/files/directory" "$mkdir_data"
direct_result=$?

# Try through API gateway
call_api "POST" "$API_GATEWAY/api/files/directory" "$mkdir_data"
gateway_result=$?

if [ $direct_result -eq 0 ] || [ $gateway_result -eq 0 ]; then
    echo -e "${GREEN}✓ Test directory created successfully${NC}"
else
    echo -e "${RED}✗ Failed to create test directory${NC}"
fi

# Test 4: Write file
echo -e "${GREEN}Test 4: Writing Test File${NC}"
write_data="{\"path\":\"$TEST_FILE\",\"content\":\"This is a test file created by the File Service test script.\",\"createDirectory\":true}"

# Try direct service
call_api "POST" "$API_HOST/api/files/write" "$write_data"
direct_result=$?

# Try through API gateway
call_api "POST" "$API_GATEWAY/api/files/write" "$write_data"
gateway_result=$?

if [ $direct_result -eq 0 ] || [ $gateway_result -eq 0 ]; then
    echo -e "${GREEN}✓ Test file written successfully${NC}"
else
    echo -e "${RED}✗ Failed to write test file${NC}"
fi

# Test 5: List files
echo -e "${GREEN}Test 5: Listing Files${NC}"

# Try direct service
call_api "GET" "$API_HOST/api/files?path=$TEST_DIR"
direct_result=$?

# Try through API gateway
call_api "GET" "$API_GATEWAY/api/files?path=$TEST_DIR"
gateway_result=$?

if [ $direct_result -eq 0 ] || [ $gateway_result -eq 0 ]; then
    echo -e "${GREEN}✓ Listed files successfully${NC}"
else
    echo -e "${RED}✗ Failed to list files${NC}"
fi

# Test 6: Read file
echo -e "${GREEN}Test 6: Reading File${NC}"

# Try direct service
call_api "GET" "$API_HOST/api/files/read?path=$TEST_FILE"
direct_result=$?

# Try through API gateway
call_api "GET" "$API_GATEWAY/api/files/read?path=$TEST_FILE"
gateway_result=$?

if [ $direct_result -eq 0 ] || [ $gateway_result -eq 0 ]; then
    echo -e "${GREEN}✓ Read file successfully${NC}"
else
    echo -e "${RED}✗ Failed to read file${NC}"
fi

# Test 7: Advanced search (Phase 3 feature)
echo -e "${GREEN}Test 7: Testing Advanced Search (Phase 3)${NC}"
search_data="{\"query\":\"test\",\"path\":\"$TEST_DIR\",\"options\":{\"includeContent\":true,\"contextLines\":2}}"

# Try direct service
call_api "POST" "$API_HOST/api/search/advanced" "$search_data"
direct_result=$?

# Try through API gateway
call_api "POST" "$API_GATEWAY/api/search/advanced" "$search_data"
gateway_result=$?

if [ $direct_result -eq 0 ] || [ $gateway_result -eq 0 ]; then
    echo -e "${GREEN}✓ Advanced search completed successfully${NC}"
else
    echo -e "${RED}✗ Failed to perform advanced search${NC}"
fi

# Test 8: Create workspace (Phase 3 feature)
echo -e "${GREEN}Test 8: Creating Workspace (Phase 3)${NC}"
workspace_data="{\"name\":\"Test Workspace\",\"basePath\":\"$TEST_DIR\",\"settings\":{\"ignoredPatterns\":[\"node_modules\"],\"language\":\"typescript\"}}"

# Try direct service
call_api "POST" "$API_HOST/api/workspace" "$workspace_data"
direct_result=$?

# Try through API gateway
call_api "POST" "$API_GATEWAY/api/workspace" "$workspace_data"
gateway_result=$?

if [ $direct_result -eq 0 ] || [ $gateway_result -eq 0 ]; then
    echo -e "${GREEN}✓ Workspace created successfully${NC}"
else
    echo -e "${RED}✗ Failed to create workspace${NC}"
fi

# Test 9: Delete file
echo -e "${GREEN}Test 9: Deleting Test File${NC}"

# Try direct service
call_api "DELETE" "$API_HOST/api/files?path=$TEST_FILE"
direct_result=$?

# Try through API gateway
call_api "DELETE" "$API_GATEWAY/api/files?path=$TEST_FILE"
gateway_result=$?

if [ $direct_result -eq 0 ] || [ $gateway_result -eq 0 ]; then
    echo -e "${GREEN}✓ Deleted test file successfully${NC}"
else
    echo -e "${RED}✗ Failed to delete test file${NC}"
fi

# Final summary
echo "=================================="
echo -e "${YELLOW}File Service Test Summary:${NC}"
echo "File operations were tested directly and through the API gateway."
echo "Check the output above for details on each test."
echo "For any failed tests, verify your API routes and service configuration."
echo ""
echo "Test file path: $TEST_FILE"
echo "Test directory: $TEST_DIR"
echo "=================================="