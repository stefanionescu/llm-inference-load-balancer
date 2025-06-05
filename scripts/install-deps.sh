#!/bin/bash
set -euo pipefail

# Load server configuration from root .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/load-server-config.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if ssh-agent is running and keys are added
if ! ssh-add -l &>/dev/null; then
    echo -e "${RED}No SSH keys found in ssh-agent. Please run:${NC}"
    echo "eval \$(ssh-agent -s)"
    echo "ssh-add ~/.ssh/your_private_key"
    exit 1
fi

# Configuration - SERVERS array loaded from load-server-config.sh
NODE_VERSION="20"
DEPLOY_PATH="/opt/llm-roleplay-inference-api"

# Local logging functions
log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Function to check if server is reachable
check_server() {
    local server=$1
    if ! ping -c 1 $server &> /dev/null; then
        log_error "Server $server is not reachable"
        return 1
    fi
    return 0
}

# Function to install Node.js
install_node() {
    local server=$1
    log_info "Installing Node.js ${NODE_VERSION} on $server..."
    
    ssh root@$server "
        if ! command -v node &> /dev/null; then
            echo 'Installing Node.js...'
            curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
            apt-get install -y nodejs
            echo 'Node.js installed successfully: ' \$(node -v)
        else
            current_version=\$(node -v)
            if [[ \$current_version == *\"${NODE_VERSION}\"* ]]; then
                echo 'Node.js \${current_version} is already installed'
            else
                echo 'Updating Node.js from \${current_version}'
                curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
                apt-get install -y nodejs
                echo 'Node.js updated to ' \$(node -v)
            fi
        fi
    "
}

# Function to install and configure Docker
install_docker() {
    local server=$1
    log_info "Installing Docker and dependencies on $server..."
    
    ssh root@$server "
        echo 'Updating package lists...'
        apt-get update
        
        echo 'Installing dependencies...'
        apt-get install -y \
            apt-transport-https \
            ca-certificates \
            curl \
            gnupg \
            lsb-release \
            software-properties-common
        
        if ! command -v docker &> /dev/null; then
            echo 'Installing Docker...'
            apt-get install -y docker.io
            systemctl enable docker
            systemctl start docker
            echo 'Docker installed successfully'
        else
            echo 'Docker is already installed'
        fi
        
        if ! command -v docker-compose &> /dev/null; then
            echo 'Installing Docker Compose...'
            apt-get install -y docker-compose
            echo 'Docker Compose installed successfully'
        else
            echo 'Docker Compose is already installed'
        fi
        
        docker --version
        docker-compose --version
    "
}

# Function to install and configure Nginx and Certbot
install_nginx() {
    local server=$1
    log_info "Installing Nginx and Certbot on $server..."
    
    ssh root@$server "
        echo 'Installing Nginx and Certbot...'
        apt-get install -y nginx certbot python3-certbot-nginx
        
        systemctl enable nginx
        systemctl start nginx
        
        mkdir -p /etc/letsencrypt
        mkdir -p /var/lib/letsencrypt
        mkdir -p /var/log/letsencrypt
        
        nginx -t
        
        echo 'Nginx and Certbot installed successfully'
    "
}

# Function to setup deployment directory
setup_deploy_dir() {
    local server=$1
    log_info "Setting up deployment directory on $server..."
    
    ssh root@$server "
        echo 'Creating deployment directories...'
        mkdir -p ${DEPLOY_PATH}
        chmod 755 ${DEPLOY_PATH}
        
        mkdir -p ${DEPLOY_PATH}/certbot/conf
        mkdir -p ${DEPLOY_PATH}/certbot/www
        
        echo 'Deployment directory setup completed'
    "
}

# Function to setup system configurations
setup_system() {
    local server=$1
    log_info "Configuring system settings on $server..."
    
    ssh root@$server "
        echo 'Setting up system limits...'
        cat > /etc/security/limits.d/custom.conf <<EOL
*         soft    nofile      65535
*         hard    nofile      65535
root      soft    nofile      65535
root      hard    nofile      65535
EOL
        
        echo 'Setting up sysctl configurations...'
        cat > /etc/sysctl.d/99-custom.conf <<EOL
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_tw_reuse = 1
net.ipv4.tcp_fin_timeout = 15
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15
EOL
        
        echo 'Applying sysctl settings...'
        sysctl -p /etc/sysctl.d/99-custom.conf
        
        echo 'System configurations applied'
    "
}

# Main execution
for server in "${SERVERS[@]}"; do
    log_info "Initializing server: $server"
    
    if ! check_server $server; then
        continue
    fi
    
    # Run setup steps
    install_node $server
    install_docker $server
    install_nginx $server
    setup_deploy_dir $server
    setup_system $server
    
    log_info "Server $server initialization completed successfully"
done

log_info "All servers initialized successfully"