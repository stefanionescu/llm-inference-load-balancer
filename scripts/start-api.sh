#!/bin/bash
set -euo pipefail

# Load server configuration from root .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/load-server-config.sh"

# Colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Load environment variables
if [ -f ../.env ]; then
    source ../.env
elif [ -f .env ]; then
    source .env
else
    echo -e "${RED}Error: .env file not found in parent or current directory${NC}"
    exit 1
fi

# Verify API_TOKEN is set
if [ -z "${API_TOKEN:-}" ]; then
    echo -e "${RED}Error: API_TOKEN is not set in .env file${NC}"
    exit 1
fi

# Check if ssh-agent is running and keys are added
if ! ssh-add -l &>/dev/null; then
    echo -e "${RED}No SSH keys found in ssh-agent. Please run:${NC}"
    echo "eval \$(ssh-agent -s)"
    echo "ssh-add ~/.ssh/your_private_key"
    exit 1
fi

# Configuration - SERVERS array loaded from load-server-config.sh
DEPLOY_PATH="/opt/llm-roleplay-inference-api"

# Function to check if docker is running
check_docker() {
    local server=$1
    if ! ssh root@$server "systemctl is-active --quiet docker"; then
        echo -e "${YELLOW}Docker is not running on $server, attempting to start...${NC}"
        ssh root@$server "systemctl start docker"
        sleep 5
    fi
}

# Function to verify port accessibility
check_port() {
    local port=$1
    if ! nc -z localhost $port; then
        echo -e "${RED}Port $port is not accessible${NC}"
        return 1
    fi
    return 0
}

# Function to deploy
deploy() {
    local server=$1
    echo -e "${GREEN}Deploying to $server...${NC}"
    ssh root@$server "cd $DEPLOY_PATH && {
        # Stop existing API service gracefully
        echo 'Stopping API service...'
        docker-compose down --remove-orphans || true

        # Cleanup unused Docker resources
        echo 'Cleaning up Docker system...'
        docker system prune -f --filter 'until=24h'

        # Build and start API service
        echo 'Building and starting API service...'
        docker-compose build --no-cache api
        docker-compose up -d api

        # Wait for service to initialize
        echo 'Waiting for API service to initialize...'
        sleep 30

        # Check port 3000 accessibility
        echo 'Verifying port 3000 is accessible...'
        if ! nc -z localhost 3000; then
            echo -e \"${RED}Port 3000 is not accessible${NC}\"
            docker-compose logs api
            exit 1
        fi

        # Service health checks
        echo 'Performing health checks...'
        echo 'Checking API health...'
        for i in {1..10}; do
            if curl -f \
                --connect-timeout 10 \
                --max-time 30 \
                http://localhost:3000/health &>/dev/null; then
                echo 'API is healthy'
                break
            fi
            
            if [ \$i -eq 10 ]; then
                echo -e \"${RED}API health check failed${NC}\"
                docker-compose logs api
                exit 1
            fi
            
            echo \"Waiting for API... (attempt \$i/10)\"
            sleep 15
        done

        # Verify container is running
        if ! docker-compose ps api | grep -q 'Up'; then
            echo -e \"${RED}API container is not running${NC}\"
            docker-compose logs api
            exit 1
        fi

        echo -e \"${GREEN}Deployment completed successfully${NC}\"
    }"
}

# Main execution
for server in "${SERVERS[@]}"; do
    echo -e "${GREEN}Processing server: $server${NC}"
    
    if ! ping -c 1 $server &> /dev/null; then
        echo -e "${RED}Error: Server $server is not reachable${NC}"
        continue
    fi

    # Check and ensure docker is running
    check_docker $server

    # Perform deployment
    if deploy $server; then
        echo -e "${GREEN}Successfully deployed to $server${NC}"
    else
        echo -e "${RED}Failed to deploy to $server${NC}"
        exit 1
    fi
done

echo -e "${GREEN}All deployments completed successfully${NC}"