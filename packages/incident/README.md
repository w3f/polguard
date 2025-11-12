# @w3f/monitoring-incident

The Incident service manages incident lifecycle, state persistence, and notification delivery. It provides a REST API for incident creation, acknowledgment, and resolution, serving as the central coordination point in Platform Mode.

## Key Features

- **Incident Management**: Creates, tracks, and resolves incidents with PostgreSQL persistence
- **Last Block Tracking**: Stores last processed block for each chain to enable Chain service resume
- **Notification Scheduling**: Coordinates notification delivery, retries, and escalations
- **Scheduled Maintenance**: Handles incident escalations and orphaned incident cleanup

## API Endpoints

**Incidents:**
- `POST /incidents` - Create new incident
- `GET /incidents` - List incidents with filters
- `GET /incidents/:id` - Get incident details
- `POST /incidents/:id/acknowledge` - Acknowledge incident
- `POST /incidents/:id/resolve` - Resolve incident (auto)
- `POST /incidents/:id/resolve-manual` - Resolve incident (manual via bot)

**Last Block Management:**
- `GET /last-block/:chainId` - Get last processed block for chain
- `POST /last-block` - Update last processed block

**Health & Metrics:**
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics

**API Documentation:**
- Swagger documentation available at `/api-docs` when service is running

## Configuration

The service is configured via `config/config.yaml`. Key configuration areas:

- **Database**: PostgreSQL connection details
- **Notifications**: Notification services connection details (currently only Matrix)
- **Scheduled Tasks**: Configuration for escalation checks, notification retries, and cleanup intervals

See [config.yaml.example](./config/config.yaml.example) for complete configuration options.

## Telemetry

Exposes Prometheus metrics on `localhost:9464/metrics` including default Node.js metrics.

## Development

```bash
# Run in development mode
yarn start:dev

# Run tests
yarn test
yarn test:integration
```
