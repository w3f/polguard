# @w3f/monitoring-api

Central control service for the Monitoring Platform.

## Overview

The API service serves as the central control point for the Monitoring Platform, managing incidents, configurations, and notifications. It provides a REST API for incident creation, acknowledgment, and resolution, as well as endpoints for retrieving monitoring configurations.

## Key Features

- **Incident Management**: Stores, tracks, and manages incidents
- **Configuration Management**: Provides centralized monitoring configuration
- **Notification Coordination**: Schedules and manages notification delivery
- **Persistence**: Stores incidents and their states in a database
- **Scheduled Tasks**: Performs periodic maintenance tasks

## REST API Endpoints

### Incidents

- `POST /incidents`: Create a new incident
- `GET /incidents`: List incidents with filtering options
- `GET /incidents/:id`: Get incident details
- `POST /incidents/:id/acknowledge`: Acknowledge an incident
- `POST /incidents/:id/resolve`: Resolve an incident by ID
- `POST /incidents/resolve`: Resolve an incident by criteria

### Monitoring Configuration

- `GET /monitoring-config/groups`: Get monitoring groups
- `GET /monitoring-config/accounts`: Get accounts for monitoring

### Health and Metrics

- `GET /health`: Health check endpoint that returns a 200 status code when the service is healthy
- `GET /metrics`: Prometheus metrics endpoint that exposes default Node.js metrics (memory usage, CPU usage, event loop lag, etc.)

## Scheduled Tasks

The API service performs several scheduled tasks:

- **Notification Retries**: Retries failed notifications
- **Configuration Refresh**: Refreshes monitoring configurations
- **Orphaned Incident Resolution**: Auto-resolves incidents for accounts no longer in monitoring configuration

## Configuration

The API service requires a configuration file to specify its behavior. For an example configuration, see the [example config file](./config/config.yaml.example).

## Usage

### Prerequisites

- Node.js 20+
- Yarn 4.6.0+
- PostgreSQL database

### Running the Service

```bash
# Install dependencies
yarn install

# Build the package
yarn build

# Start in production mode
yarn start
```

## Development

```bash
# Start in development mode
yarn start:dev

# Run tests
yarn test

# Run integration tests
yarn test:integration
```

### Project Structure

- `src/`: Service implementation
  - `config/`: Configuration handling
  - `database/`: Database entities and configuration
  - `health/`: Health check endpoints
  - `incident/`: Incident management
  - `metrics/`: Prometheus metrics
  - `monitoring-config/`: Monitoring configuration management
  - `notification/`: Notification handling
  - `scheduler/`: Scheduled tasks