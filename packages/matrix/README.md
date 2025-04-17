# @w3f/monitoring-matrix

Matrix notification service for the Monitoring Platform.

## Overview

The Matrix service is responsible for delivering incident notifications to Matrix rooms and providing a bot interface for incident management. It receives notification requests from the API service and sends them to the appropriate Matrix rooms.

## Key Features

- **Notification Delivery**: Sends incident notifications to Matrix rooms
- **Bot Commands**: Provides commands for interacting with incidents
- **Incident Acknowledgment**: Allows users to acknowledge incidents via Matrix

## Bot Commands

The Matrix bot supports several commands:

- `!help`: Show help message
- `!open`: List all open (non-resolved) incidents
- `!unacked`: List all incidents requiring acknowledgment
- `!incident <id>`: Show detailed information about a specific incident
- `!ack <id>`: Acknowledge an incident by ID

## Configuration

The Matrix service requires a configuration file to specify its behavior. For an example configuration, see the [example config file](./config/config.yaml.example).

## Usage

### Prerequisites

- Node.js 20+
- Yarn 4.6.0+
- Access to a Matrix homeserver
- API service (for incident management)

### Installation

```bash
# Install dependencies
yarn install

# Build the package
yarn build
```

### Running the Service

```bash
# Start in development mode
yarn start:dev

# Start in production mode
yarn start
```

## Development

### Project Structure

- `src/lib/`: Core Matrix functionality
  - `matrix-bot.ts`: Bot implementation with command handling
  - `matrix-client.ts`: Matrix client wrapper
  - `interfaces.ts`: Type definitions and interfaces
- `src/service/`: Service implementation
  - `config/`: Configuration handling
  - `health/`: Health check endpoints
  - `incident/`: Incident management
  - `metrics/`: Prometheus metrics

### Testing

```bash
# Run tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with coverage
yarn test:coverage
