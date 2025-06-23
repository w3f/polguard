# @w3f/monitoring-matrix

The Matrix service is responsible for delivering incident notifications to Matrix rooms and providing a bot interface for incident management. It receives notification requests from the API service and sends them to the appropriate Matrix rooms.

## Key Features

- **Notification Delivery**: Sends incident notifications to Matrix rooms
- **Bot Commands**: Provides commands for interacting with incidents
- **Incident Acknowledgment**: Allows users to acknowledge incidents via Matrix

## REST API Endpoints

### Notifications

- `POST /notifications`: Send a notification to a Matrix room
  - Request body: `{ "channelId": "string", "message": "string" }`
  - Response: `{ "success": true }` or error

### Health and Metrics

- `GET /health`: Health check endpoint that returns a 200 status code when the service is healthy
- `GET /metrics`: Prometheus metrics endpoint that exposes default Node.js metrics (memory usage, CPU usage, event loop lag, etc.)

## Bot Commands

The Matrix bot supports several commands:

- `!help`: Show help message with all available commands
- `!unresolved`: List all non-resolved incidents for this room
- `!unacked`: List all incidents requiring acknowledgment for this room
- `!info <id>`: Show detailed information about a specific incident
- `!ack <id>`: Acknowledge an incident by ID
- `!monitor <chain> <account>`: Check if an account is being monitored on a specific chain for this channel
- `!query [filters...]`: Query incidents with custom filters
  - Available filters: `account`, `groupId`, `handlerType`, `chain`, `createdAfter`, `createdBefore`, `isResolved`, `isAcked`, `needsAck`
  - Example: `!query createdAfter=2025-01-01 createdBefore=2025-01-31 isResolved=false`
  - Boolean filters (`isResolved`, `isAcked`, `needsAck`) accept `true` or `false` values
  - Date filters (`createdAfter`, `createdBefore`) accept ISO date format (supports both date-only like `2025-01-01` and full datetime like `2025-01-01T10:30:00Z`)

## Configuration

The Matrix service requires a configuration file to specify its behavior. For an example configuration, see the [example config file](./config/config.yaml.example).

## Usage

### Prerequisites

- Node.js 20+
- Yarn 4.6.0+
- Access to a Matrix homeserver
- API service (for incident management)

### Running the Service

```bash
yarn install
yarn build
yarn start
```

## Development

```bash
yarn start:dev
yarn test
```

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
