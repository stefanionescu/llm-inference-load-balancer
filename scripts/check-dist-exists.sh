#!/bin/bash

# Load server configuration from root .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/load-server-config.sh"
for server in "${SERVERS[@]}"; do
  echo "Checking $server..."
  ssh root@$server "cd /opt/llm-roleplay-inference-api && docker ps -q | xargs -I {} docker exec {} ls -la /app/dist"
done