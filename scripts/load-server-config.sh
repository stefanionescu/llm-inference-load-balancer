#!/bin/bash
# Helper script to load server configuration from root .env file
# This script should be sourced by other scripts that need server IPs

# Get the root directory (parent of scripts directory)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

# Check if .env file exists in root
if [ ! -f "${ENV_FILE}" ]; then
    echo "Error: .env file not found at ${ENV_FILE}"
    echo "Please create .env file in the root directory with SERVER_1_IP and SERVER_2_IP variables"
    exit 1
fi

# Load environment variables from root .env
source "${ENV_FILE}"

# Validate required environment variables
if [ -z "${SERVER_1_IP:-}" ] || [ -z "${SERVER_2_IP:-}" ]; then
    echo "Error: SERVER_1_IP and SERVER_2_IP must be set in root .env file"
    exit 1
fi

# Export server array for scripts to use
SERVERS=("${SERVER_1_IP}" "${SERVER_2_IP}")
export SERVER_1_IP SERVER_2_IP 