#!/bin/bash
set -euo pipefail

# Load server configuration from root .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/load-server-config.sh"

# Configuration - SERVERS array loaded from load-server-config.sh
DEPLOY_PATH="/opt/llm-roleplay-inference-api"

# Colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to check server connectivity
check_server_connectivity() {
    local server="$1"
    if ! ping -c 1 "$server" &> /dev/null; then
        echo -e "${RED}Cannot reach server $server${NC}"
        return 1
    fi
    return 0
}

# Function to get API token
get_api_token() {
    local server="$1"
    local api_token
    api_token=$(ssh root@"$server" "cd $DEPLOY_PATH && grep API_TOKEN .env | cut -d '=' -f2" || echo "")
    if [ -z "$api_token" ]; then
        echo -e "${RED}Failed to get API_TOKEN from .env on $server${NC}"
        return 1
    fi
    echo "$api_token"
}

# Function to check containers
check_containers() {
    local server="$1"
    local containers
    containers=$(ssh root@"$server" "docker ps --format '{{.Names}}' | grep -E 'api|nginx'")
    if [ -z "$containers" ]; then
        echo -e "${RED}No expected containers running on $server${NC}"
        return 1
    fi
    echo "Running containers:"
    echo "$containers"
    return 0
}

# Function to check API health
check_api_health() {
    local server="$1"
    local api_token="$2"
    local max_retries=3
    local retry=0
    
    echo "Checking API health..."
    while [ $retry -lt $max_retries ]; do
        if curl -f -H "Authorization: Bearer $api_token" "http://$server:3000/health" &>/dev/null; then
            echo -e "${GREEN}API health check passed${NC}"
            return 0
        fi
        retry=$((retry + 1))
        if [ $retry -eq $max_retries ]; then
            echo -e "${RED}API health check failed on $server after $max_retries attempts${NC}"
            echo "Getting logs..."
            ssh root@"$server" "cd $DEPLOY_PATH && docker-compose logs --tail=100"
            return 1
        fi
        echo "Retrying API health check in 10 seconds... (attempt $retry/$max_retries)"
        sleep 10
    done
}

# Function to check system resources
check_system_resources() {
    local server="$1"
    
    # Check memory usage
    local memory_usage
    memory_usage=$(ssh root@"$server" "free -m | awk '/Mem:/ {printf \"%.1f\", \$3/\$2 * 100}'")
    if (( $(echo "$memory_usage > 90" | bc -l) )); then
        echo -e "${YELLOW}Warning: High memory usage on $server: ${memory_usage}%${NC}"
        echo "Top memory-consuming processes:"
        ssh root@"$server" "ps aux --sort=-%mem | head -n 5"
    fi
    
    # Check disk usage
    local disk_usage
    disk_usage=$(ssh root@"$server" "df -h / | awk 'NR==2 {print \$5}' | tr -d '%'")
    if [ "$disk_usage" -gt 80 ]; then
        echo -e "${YELLOW}Warning: High disk usage on $server: ${disk_usage}%${NC}"
        echo "Largest directories in /:"
        ssh root@"$server" "du -h / 2>/dev/null | sort -rh | head -n 5"
    fi
    
    # Check Docker system status
    echo "Checking Docker system status..."
    ssh root@"$server" "docker system df"
}

# Main service check function
check_service() {
    local server="$1"
    echo -e "${GREEN}Checking service on $server...${NC}"
    
    # Check server connectivity
    check_server_connectivity "$server" || return 1
    
    # Get API token
    local api_token
    api_token=$(get_api_token "$server") || return 1
    
    # Check containers
    check_containers "$server" || return 1
    
    # Check API health
    check_api_health "$server" "$api_token" || return 1
    
    # Check system resources
    check_system_resources "$server"
    
    echo -e "${GREEN}Service check passed on $server${NC}"
    return 0
}

# Main execution
failed_servers=()

for server in "${SERVERS[@]}"; do
    echo -e "\n${GREEN}Verifying deployment on $server...${NC}"
    
    if ! check_service "$server"; then
        failed_servers+=("$server")
        echo -e "${RED}Verification failed for $server${NC}"
    fi
done

# Report results
if [ ${#failed_servers[@]} -eq 0 ]; then
    echo -e "\n${GREEN}All deployments verified successfully${NC}"
    exit 0
else
    echo -e "\n${RED}Deployment verification failed on servers: ${failed_servers[*]}${NC}"
    exit 1
fi