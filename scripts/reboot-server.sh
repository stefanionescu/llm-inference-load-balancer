#!/bin/bash

# Load server configuration from root .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/load-server-config.sh"

for server in "${SERVERS[@]}"; do
    ssh root@$server "reboot"
done