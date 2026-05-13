#!/bin/bash

DB_NAME="incidents-dev"
POSTGRES_PASSWORD="postgres"
CONTAINER_NAME="postgres-test"

# Check if postgres-test container exists (running or stopped)
CONTAINER_ID=$(docker ps -a -q --filter "name=$CONTAINER_NAME")

if [ -z "$CONTAINER_ID" ]; then
  echo "No $CONTAINER_NAME container found. Creating a new one..."
else
  echo "Found $CONTAINER_NAME container: $CONTAINER_ID"
  echo "Stopping and removing container..."
  docker stop $CONTAINER_ID 2>/dev/null || true
  docker rm $CONTAINER_ID
  echo "Container removed successfully."
fi

echo "Creating a new postgres container with database '$DB_NAME'..."
docker run -d --name $CONTAINER_NAME -p 5432:5432 \
  -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD \
  -e POSTGRES_DB=$DB_NAME \
  postgres

echo "Waiting for postgres to start..."
sleep 3

# Wait until Postgres is ready
until docker exec $CONTAINER_NAME pg_isready -U postgres > /dev/null 2>&1; do
  echo "Waiting for postgres to be ready..."
  sleep 2
done

echo "Postgres container reset and database '$DB_NAME' created successfully."
echo ""
echo "Connection details:"
echo "  Host:     localhost"
echo "  Port:     5432"
echo "  User:     postgres"
echo "  Password: postgres"
echo "  Database: $DB_NAME"
