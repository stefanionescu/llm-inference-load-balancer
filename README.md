# LLM Roleplay Inference API

A production-grade API service for handling AI inference requests across multiple providers with intelligent load balancing, failover capabilities, and Redis-based rate limiting. Initially meant to be used in [this project](https://github.com/stefanionescu/llm-roleplay-webapp) but you can use the code for any LLM project.

## Table of Contents
- [System Architecture](#system-architecture)
- [Load Balancer Overview](#load-balancer-overview)
- [Environment Setup](#environment-setup)
- [Deployment Guide](#deployment-guide)
- [Configuration](#configuration)
- [Maintenance](#maintenance)
- [API Endpoints](#api-endpoints)

## System Architecture

The API is designed with a multi-layered architecture that provides high availability and intelligent request distribution:

```
┌─────────────────┐    ┌─────────────────┐      
│  Load Balancer  │    │   Bare Metal    │      
│  (DigitalOcean) │────│   (Machine 1)   │──────────────┐
└─────────────────┘    └─────────────────┘              │
                             │                          │
                      ┌──────┴──────┐            ┌──────┴──────┐
                      │ Roleplay LB │            │ Content LB  │
                      └─────────────┘            └─────────────┘
                              │                           │
                  ┌───────────┼─────────────┐             │───────────┐
                  │           │             │        ┌────▼────┐      │
          ┌───────▼───┐ ┌─────▼─────┐ ┌─────▼─────┐  │ OpenAI  │ ┌────▼─────┐
          │  Groq     │ │ Together  │ │OpenRouter │  │         │ │Anthropic │
          │ Fireworks │ │ Replicate │ │ AvianIO   │  │         │ │          │
          │ DeepInfra │ │ Hyperbolic│ │ AwanLLM   │  └─────────┘ └──────────┘
          │    ...    │ │    ...    │ │   ...     │
          └───────────┘ └───────────┘ └───────────┘
```

## Load Balancer Overview

The system features two specialized load balancers:

### 1. Roleplay Load Balancer
- **Purpose**: Handles conversational AI requests with multiple message exchanges
- **Providers**: 13+ providers including Groq, Together, Fireworks, Replicate, Hyperbolic, DeepInfra, OpenRouter, and more
- **Features**: 
  - Smart provider selection based on real-time capacity
  - Redis-based rate limiting with per-minute and per-second quotas
  - Concurrent request tracking to prevent overloading
  - Automatic failover to healthy providers

### 2. Content Usage Load Balancer  
- **Purpose**: Handles content moderation and usage verification requests
- **Providers**: OpenAI and Anthropic
- **Features**: 
  - Simplified provider selection for high-reliability use cases
  - Focused on content safety and compliance

### Load Balancing Algorithm
The system uses a Redis-based selection algorithm that considers:
- **Rate Limits**: Per-minute and per-second quotas for each API key
- **Concurrent Requests**: Active request tracking to prevent overloading
- **Provider Health**: Automatic exclusion of unhealthy providers
- **Weighted Selection**: Prioritizes providers with higher availability

## Environment Setup

### Prerequisites
- Node.js 18+ and TypeScript
- Docker and Docker Compose
- Redis instance (for rate limiting and coordination)
- SSH access to bare metal servers
- SSL certificates for HTTPS endpoints

### Project Structure
```
llm-roleplay-inference-api/
├── environment/          # Server-specific configurations
│   ├── server-1/         # Configuration for first bare metal server
│   │   └── .env          # Server-1 specific environment variables
│   ├── server-2/         # Configuration for second bare metal server
│   │   └── .env          # Server-2 specific environment variables
│   └── server-N/         # Additional servers as needed
├── src/                  # Source code
├── scripts/              # Deployment and maintenance scripts
├── .env                  # Root configuration (server IPs)
└── README.md
```

### Setting Up Environment Directories

1. **Create Root Environment File**
   Create `.env` in the root directory with your server IPs:
   ```bash
   # Server IP addresses for deployment
   SERVER_1_IP=192.168.1.100
   SERVER_2_IP=192.168.1.101
   ```

2. **Create Server-Specific Directories**
   ```bash
   mkdir -p environment/server-1
   mkdir -p environment/server-2
   # Add more servers as needed
   ```

3. **Configure Each Server's Environment**
   Create `.env` files in each server directory with the configuration specific to that server.

## Deployment Guide

### Step 1: Configure Environment Variables

For each server, create an `.env` file in `environment/server-N/` with the following structure:

#### Redis Configuration (Required)
```bash
# Redis connection for rate limiting and coordination
REDIS_REST_URL=your-redis-url.com
REDIS_REST_PORT=6379
REDIS_PASSWORD=your-redis-password
```

#### API Security (Required)
```bash
# API authentication token
API_TOKEN=your-api-token-here
```

#### Provider Configurations (Required)
Configure at least two providers (main ones are Together and Fireworks but can change this). Each provider config is a JSON array of API keys with rate limits:

```bash
# OpenAI Configuration (required for content usage)
OPENAI_CONFIGS='[
  {
    "apiKey": "sk-your-openai-key-1",
    "maxRequestsPerMinute": 500
  },
  {
    "apiKey": "sk-your-openai-key-2", 
    "maxRequestsPerMinute": 1000
  }
]'

# Together AI Configuration
TOGETHER_CONFIGS='[
  {
    "apiKey": "your-together-key-1",
    "maxRequestsPerMinute": 600
  }
]'

# Fireworks AI Configuration
FIREWORKS_CONFIGS='[
  {
    "apiKey": "your-fireworks-key-1",
    "maxRequestsPerMinute": 400,
    "maxConcurrentRequests": 8
  }
]'
```

#### Optional Provider Configurations
Add any of these providers based on your access:

```bash
# Groq Configuration
GROQ_CONFIGS='[{"apiKey": "gsk_your-groq-key", "maxRequestsPerMinute": 30}]'

# Anthropic Configuration  
ANTHROPIC_CONFIGS='[{"apiKey": "sk-ant-your-key", "maxRequestsPerMinute": 50}]'

# Replicate Configuration
REPLICATE_CONFIGS='[{"apiKey": "r8_your-replicate-key", "maxRequestsPerMinute": 100}]'

# Hyperbolic Configuration
HYPERBOLIC_CONFIGS='[{"apiKey": "your-hyperbolic-key", "maxRequestsPerMinute": 200}]'

# DeepInfra Configuration
DEEPINFRA_CONFIGS='[{"apiKey": "your-deepinfra-key", "maxRequestsPerMinute": 300}]'

# OpenRouter Configuration
OPENROUTER_CONFIGS='[{"apiKey": "sk-or-your-key", "maxRequestsPerMinute": 200}]'

# AwanLLM Configuration
AWAN_CONFIGS='[{"apiKey": "your-awan-key", "maxRequestsPerMinute": 100}]'

# KlusterAI Configuration
KLUSTER_AI_CONFIGS='[{"apiKey": "your-kluster-key", "maxRequestsPerMinute": 150}]'

# AvianIO Configuration
AVIAN_IO_CONFIGS='[{"apiKey": "your-avian-key", "maxRequestsPerMinute": 120}]'

# Lambda Labs Configuration
LAMBDA_LABS_CONFIGS='[{"apiKey": "your-lambda-key", "maxRequestsPerMinute": 80}]'

# Novita AI Configuration
NOVITA_AI_CONFIGS='[{"apiKey": "your-novita-key", "maxRequestsPerMinute": 200}]'

# Inference.net Configuration
INFERENCE_NET_CONFIGS='[{"apiKey": "your-inference-key", "maxRequestsPerMinute": 100}]'
```

### Step 2: Deploy to Bare Metal Servers

1. **Prepare SSH Access**
   ```bash
   eval $(ssh-agent -s)
   ssh-add ~/.ssh/your_private_key
   ```

2. **Deploy to All Servers**
   ```bash
   ./scripts/deploy-to-server.sh
   ```

   This script will:
   - Verify all environment files exist and are valid
   - Copy source code to each server
   - Apply server-specific configurations
   - Create deployment backups
   - Set proper permissions

### Step 3: Start API Services

1. **Start Services on All Servers**
   ```bash
   ./scripts/start-api.sh
   ```

2. **Verify Individual Server Health**
   ```bash
   ./scripts/manual-health-check.sh
   ```

### Step 4: Configure Load Balancer

Set up your external load balancer (e.g., DigitalOcean Load Balancer) to distribute traffic between your servers:

- **Health Check**: `GET /health`
- **Sticky Sessions**: Not required
- **Protocol**: HTTPS with SSL termination
- **Ports**: 443 → 3000 (or your configured port)

## Configuration

### Rate Limiting Configuration

Each provider supports these rate limiting parameters:

```javascript
{
  "apiKey": "your-api-key",
  "maxRequestsPerMinute": 500,        // RPM limit
  "maxConcurrentRequests": 10,        // Concurrent request limit (for providers like DeepInfra)
}
```

### Docker Configuration

The service runs in Docker containers with:
- **Image**: Node.js 18 Alpine
- **Port**: 3000 (configurable)
- **Health Check**: Built-in endpoint
- **Auto-restart**: On failure

## API Endpoints

### Roleplay Chat
```
POST /roleplay-balancer
Authorization: Bearer <API_TOKEN>
Content-Type: application/json

{
  "messages": [
    {
      "role": "user",
      "content": [{"type": "text", "text": "Hello!"}]
    }
  ],
  "systemPrompt": "You are a helpful assistant.",
  "maxTokens": 1000,
  "stream": false
}
```

### Content Usage Verification
```
POST /content-usage-balancer  
Authorization: Bearer <API_TOKEN>
Content-Type: application/json

{
  "prompt": "Content to analyze",
  "maxTokens": 500,
  "stream": false
}
```

### Health Check
```
GET /health

Response: {
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "providers": {
    "roleplay": 13,
    "content": 2
  }
}
```

## Maintenance

### Available Scripts

| Script | Purpose |
|--------|---------|
| `deploy-to-server.sh` | Deploy code to all configured servers |
| `start-api.sh` | Start API services on all servers |
| `manual-health-check.sh` | Verify deployment health |
| `check-logs.sh` | Review application logs |
| `check-port-access.sh` | Validate port configurations |
| `delete-server-resources.sh` | Clean up server resources |
| `install-deps.sh` | Install dependencies |
| `reboot-server.sh` | Restart servers |
| `check-dist-exists.sh` | Verify build artifacts |

### Monitoring and Logs

- **Log Location**: `/opt/llm-roleplay-inference-api/logs/`
- **Log Format**: JSON with timestamps and request IDs
- **Health Monitoring**: Built-in health check endpoint
- **Metrics**: Request counts, response times, error rates

### Scaling

To add more servers:

1. **Add Server IP to Root `.env`**
   ```bash
   SERVER_3_IP=192.168.1.102
   ```

2. **Create Environment Directory**
   ```bash
   mkdir -p environment/server-3
   ```

3. **Configure Server Environment**
   ```bash
   cp environment/server-1/.env environment/server-3/.env
   # Edit server-3/.env with appropriate configurations
   ```

4. **Update Deployment Scripts**
   The scripts automatically detect new servers based on environment directories.

5. **Deploy**
   ```bash
   ./scripts/deploy-to-server.sh
   ```

### Troubleshooting

**Provider Selection Issues**
- Check Redis connectivity
- Verify provider API keys are valid
- Review rate limit configurations

**Deployment Failures**
- Ensure SSH keys are properly configured
- Verify server connectivity
- Check disk space on target servers

**Performance Issues**
- Monitor Redis performance
- Check concurrent request limits
- Review provider response times

