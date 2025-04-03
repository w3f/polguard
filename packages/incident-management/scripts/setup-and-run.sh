#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up Incident Management Service...${NC}"

# Check if PostgreSQL is running in Docker
echo -e "${YELLOW}Checking PostgreSQL...${NC}"
if ! docker ps | grep incident-management-postgres > /dev/null 2>&1; then
  echo -e "${YELLOW}PostgreSQL container not found. Starting PostgreSQL in Docker...${NC}"
  docker run --name incident-management-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=incident_management -p 5432:5432 -d postgres:13
  echo -e "${GREEN}Waiting for PostgreSQL to start...${NC}"
  sleep 5
fi

# Check if PostgreSQL is ready
echo -e "${YELLOW}Checking PostgreSQL connection...${NC}"
if ! docker exec incident-management-postgres pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
  echo -e "${RED}PostgreSQL is not ready. Please check the container logs and try again.${NC}"
  exit 1
fi

# Create database if it doesn't exist
echo -e "${YELLOW}Creating database if it doesn't exist...${NC}"
if ! docker exec incident-management-postgres psql -U postgres -lqt | cut -d \| -f 1 | grep -qw incident_management; then
  echo -e "${YELLOW}Creating incident_management database...${NC}"
  docker exec incident-management-postgres psql -U postgres -c "CREATE DATABASE incident_management;"
  echo -e "${GREEN}Database created successfully.${NC}"
else
  echo -e "${GREEN}Database already exists.${NC}"
fi

# Change to the package directory
cd "$(dirname "$0")/.."

# Build the project
echo -e "${YELLOW}Building the project...${NC}"
yarn build
echo -e "${GREEN}Build completed.${NC}"

# Run migrations
echo -e "${YELLOW}Running migrations...${NC}"
yarn migration:run
echo -e "${GREEN}Migrations completed.${NC}"

# Start the service
echo -e "${YELLOW}Starting the service...${NC}"
echo -e "${GREEN}Incident Management Service is running at http://localhost:3000${NC}"
yarn start:dev
