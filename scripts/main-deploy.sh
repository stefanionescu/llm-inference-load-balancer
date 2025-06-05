#!/bin/bash
echo "Starting deployment..."
docker-compose -f docker-compose.yml down
docker system prune -f
docker-compose -f docker-compose.yml build --no-cache
docker-compose -f docker-compose.yml up -d
echo "Deployment complete!"