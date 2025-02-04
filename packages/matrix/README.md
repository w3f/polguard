# Matrix Service

A service that handles incident notifications and interactions through Matrix chat rooms.

## Architecture

The service is split into two main parts:

### Core business logic (lib/)
- `matrix-client.ts`: Base Matrix client handling common operations
  - Room management
  - Message sending
  - Authentication and connection

- `matrix-bot.ts`: Extended Matrix client with specific features
  - Message handling
  - Basic incident acknowledgment (draft)
  - Syncs with incident management service for acknowledgment status (draft)

### Service layer (service/)
- NestJS-specific code
- Components:
  - Incident handling: Processes events from Redis streams
  - Configuration: Validates and processes service config

## Development

```bash
# Install dependencies
yarn

# Start in development mode
yarn start:dev

# Run tests
yarn test

# Build
yarn build

# Start in production mode
yarn start:prod
```

## Configuration

The service requires a configuration file with:

```yaml
serverAddress: "https://matrix.org"  # Matrix homeserver URL
userId: "@bot:matrix.org"            # Bot user ID
password: "your-password"            # Bot password
logging:
  level: info                        # Logging level (trace, debug, info, warn, error)
rooms:                               # Rooms to join and monitor
  - id: "!roomid:matrix.org"
    acknowledgement: true            # Whether room supports incident acknowledgment
```

## API

### GET /health
Returns 200 OK if service is healthy

### GET /metrics
Returns Prometheus metrics with default Node.js metrics
