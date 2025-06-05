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

# Check if ssh-agent is running and keys are added
if ! ssh-add -l &>/dev/null; then
    echo -e "${RED}No SSH keys found in ssh-agent. Please run:${NC}"
    echo "eval \$(ssh-agent -s)"
    echo "ssh-add ~/.ssh/your_private_key"
    exit 1
fi

# Configuration - SERVERS array loaded from load-server-config.sh
DEPLOY_PATH="/opt/llm-roleplay-inference-api"
FILES_TO_COPY=(
    "src"
    "package.json"
    "tsconfig.json"
    "Dockerfile"
    "docker-compose.yml"
    ".dockerignore"
)

# Function to check if server is reachable
check_server() {
    local server=$1
    if ! ping -c 1 $server &> /dev/null; then
        echo -e "${RED}Error: Server $server is not reachable${NC}"
        return 1
    fi
}

# Function to verify environment variables for a specific server
verify_env_file() {
    local server_index=$1
    local env_file="../environment/server-$((server_index + 1))/.env"
    local required_vars=(
        "REDIS_REST_URL"
        "REDIS_REST_PORT"
        "REDIS_PASSWORD"
        "API_TOKEN"
        "OPENAI_CONFIGS"
        "TOGETHER_CONFIGS"
        "FIREWORKS_CONFIGS"
    )
    
    if [ ! -f "$env_file" ]; then
        echo -e "${RED}.env file missing for server-$((server_index + 1)): $env_file${NC}"
        return 1
    fi
    
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$env_file"; then
            echo -e "${RED}Missing required env variable: ${var} in $env_file${NC}"
            return 1
        fi
    done
}

# Function to cleanup old deployments
cleanup_old_deployments() {
    local server=$1
    local keep_builds=5
    
    echo -e "${GREEN}Cleaning up old deployments on $server...${NC}"
    ssh root@$server "cd /opt && ls -t llm-roleplay-inference-api.backup.* 2>/dev/null | 
        tail -n +$((keep_builds + 1)) | xargs -r rm -rf"
}

# Function to verify critical files
verify_critical_files() {
    local critical_files=(
        "package.json" 
        "Dockerfile" 
        "docker-compose.yml"
    )
    local missing_files=()
    
    for file in "${critical_files[@]}"; do
        if [ ! -e "../$file" ]; then
            missing_files+=($file)
        fi
    done
    
    if [ ${#missing_files[@]} -ne 0 ]; then
        echo -e "${RED}Error: Critical files missing: ${missing_files[*]}${NC}"
        return 1
    fi
}

# Function to copy files
copy_files() {
    local server=$1
    local server_index=$2
    echo -e "${GREEN}Copying files to $server...${NC}"
    
    # Create directory with proper permissions
    ssh root@$server "mkdir -p $DEPLOY_PATH && chmod 755 $DEPLOY_PATH"
    
    # Create backup of current deployment if it exists
    ssh root@$server "if [ -d $DEPLOY_PATH ]; then 
        timestamp=\$(date +%Y%m%d_%H%M%S)
        cp -r $DEPLOY_PATH ${DEPLOY_PATH}.backup.\$timestamp
    fi"
    
    # Copy project files
    for file in "${FILES_TO_COPY[@]}"; do
        if [ -e "../$file" ]; then
            echo "Copying $file..."
            scp -r "../$file" "root@$server:$DEPLOY_PATH/"
        else
            echo -e "${YELLOW}Warning: $file not found, skipping...${NC}"
        fi
    done
    
    # Copy server-specific .env file
    local env_file="../environment/server-$((server_index + 1))/.env"
    echo "Copying server-specific .env file from $env_file..."
    scp "$env_file" "root@$server:$DEPLOY_PATH/.env"
    
    # Copy deployment script
    echo "Copying deployment script..."
    scp -r "main-deploy.sh" "root@$server:$DEPLOY_PATH/"
    
    # Set permissions
    ssh root@$server "cd $DEPLOY_PATH && chmod +x main-deploy.sh"
    
    # Verify copied files
    echo "Verifying copied files..."
    ssh root@$server "cd $DEPLOY_PATH && {
        if [ ! -f package.json ] || [ ! -f Dockerfile ] || [ ! -f .env ]; then
            echo 'Critical files missing after copy'
            exit 1
        fi
    }"
}

# Main execution
echo -e "${GREEN}Starting deployment process${NC}"

# Verify critical files before starting
if ! verify_critical_files; then
    echo -e "${RED}Critical files verification failed${NC}"
    exit 1
fi

# Verify all server-specific .env files before starting deployment
for i in "${!SERVERS[@]}"; do
    if ! verify_env_file $i; then
        echo -e "${RED}Environment file verification failed for server-$((i + 1))${NC}"
        exit 1
    fi
done

for i in "${!SERVERS[@]}"; do
    server="${SERVERS[$i]}"
    echo -e "${GREEN}Processing server: $server${NC}"
    if check_server $server; then
        # Clean up old deployments first
        cleanup_old_deployments "$server"
        
        if copy_files "$server" "$i"; then
            echo -e "${GREEN}Successfully deployed to $server${NC}"
        else
            echo -e "${RED}Failed to deploy to $server${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}Skipping server $server due to connectivity issues${NC}"
    fi
done

echo -e "${GREEN}Deployment completed successfully${NC}"