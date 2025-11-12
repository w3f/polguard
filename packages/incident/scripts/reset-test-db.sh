#!/bin/bash

DB_NAME="monitoring"
POSTGRES_PASSWORD="postgres"

# Check if postgres-test container exists (running or stopped)
CONTAINER_ID=$(docker ps -a -q --filter "name=postgres-test")

if [ -z "$CONTAINER_ID" ]; then
  echo "No postgres-test container found. Creating a new one..."
else
  echo "Found postgres-test container: $CONTAINER_ID"
  echo "Stopping and removing container..."
  # Stop the container if it's running
  docker stop $CONTAINER_ID 2>/dev/null || true
  # Remove the container
  docker rm $CONTAINER_ID
  
  echo "Container removed successfully."
fi

echo "Creating a new postgres container with database '$DB_NAME'..."
docker run -d --name postgres-test -p 5432:5432 -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD -e POSTGRES_DB=$DB_NAME postgres

echo "Waiting for postgres to start..."
sleep 5

# Wait until Postgres is ready
until docker exec postgres-test pg_isready -U postgres > /dev/null 2>&1; do
  echo "Waiting for postgres to be ready..."
  sleep 2
done

echo "Postgres container reset and database '$DB_NAME' created successfully."
