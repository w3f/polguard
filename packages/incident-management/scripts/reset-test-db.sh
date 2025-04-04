#!/bin/bash

DB_NAME="incident_management"
POSTGRES_PASSWORD="postgres"

# Find the postgres container
CONTAINER_ID=$(docker ps -q --filter "name=postgres")

if [ -z "$CONTAINER_ID" ]; then
  echo "No postgres container found. Creating a new one..."
  docker run -d --name postgres-test -p 5432:5432 -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD postgres
else
  echo "Found postgres container: $CONTAINER_ID"
  echo "Stopping and removing container..."
  docker stop $CONTAINER_ID
  docker rm $CONTAINER_ID
  
  echo "Creating a new postgres container..."
  docker run -d --name postgres-test -p 5432:5432 -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD postgres
fi

echo "Waiting for postgres to start..."
sleep 5

# Wait until Postgres is ready
until docker exec postgres-test pg_isready -U postgres > /dev/null 2>&1; do
  echo "Waiting for postgres to be ready..."
  sleep 2
done

# Create the database
echo "Creating database '$DB_NAME'..."
docker exec -u postgres postgres-test psql -c "CREATE DATABASE $DB_NAME;"

echo "Postgres container reset and database '$DB_NAME' created successfully."
