#!/bin/bash

# Load server configuration from root .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/load-server-config.sh"

# Check UFW status on both servers
for server in "${SERVERS[@]}"; do
    echo "=== Checking UFW on $server ==="
    ssh root@$server "ufw status"
done

# Check docker containers on both servers
for server in "${SERVERS[@]}"; do
    echo "=== Checking Docker containers on $server ==="
    ssh root@$server "docker ps"
done

# Check Nginx config on both servers
for server in "${SERVERS[@]}"; do
    echo "=== Checking Nginx config on $server ==="
    ssh root@$server "docker exec llm-roleplay-inference-api_nginx_1 cat /etc/nginx/conf.d/default.conf"
done

# Check Nginx logs on both servers
for server in "${SERVERS[@]}"; do
    echo "=== Checking Nginx logs on $server ==="
    ssh root@$server "docker logs llm-roleplay-inference-api_nginx_1"
done

# Check Nginx runtime config on both servers
for server in "${SERVERS[@]}"; do
    echo "=== Checking Nginx runtime config on $server ==="
    ssh root@$server "docker exec llm-roleplay-inference-api_nginx_1 nginx -T"
done
