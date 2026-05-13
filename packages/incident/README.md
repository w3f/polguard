# @w3f/polguard-incident

The Incident service manages incident lifecycle, state persistence, and notification delivery. It provides a REST API for incident creation, acknowledgment, and resolution, serving as the central coordination point in Platform Mode.

## Key Features

- **Incident Management**: Creates, tracks, and resolves incidents with PostgreSQL persistence
- **Last Block Tracking**: Stores last processed block for each chain to enable Chain service resume
- **Notification Scheduling**: Coordinates notification delivery, retries, and escalations
- **Scheduled Maintenance**: Handles incident escalations and orphaned incident cleanup

## API Endpoints

**Incidents:**
- `POST /incidents` — Create new incident
- `GET /incidents` — List incidents with filters
- `GET /incidents/:id` — Get incident details
- `POST /incidents/:id/acknowledge` — Acknowledge incident
- `POST /incidents/:id/resolve` — Resolve incident (chain service)
- `POST /incidents/:id/resolve-manual` — Resolve incident (manual via bot)

**Last Block Management:**
- `GET /last-block/:chainId` — Get last processed block for chain
- `POST /last-block` — Update last processed block

**Other:**
- `GET /health` — Health check
- `GET /docs` — Swagger UI

## Configuration

The service is configured via `config/config.yaml`. Key configuration areas:

- **Database**: PostgreSQL connection details
- **Notifications**: Notification services connection details (currently only Matrix)
- **Scheduled Tasks**: Configuration for escalation checks, notification retries, and cleanup intervals

See [config.yaml.example](./config/config.yaml.example) for complete configuration options.

## Development

```bash
# Start local Postgres (for manual development)
bash scripts/reset-test-db.sh

# Build and run
yarn build
yarn start

# Run tests (unit)
yarn test

# Run integration tests (requires Docker — uses Testcontainers to spin up PostgreSQL automatically)
yarn test:integration
```

**Schema changes:** edit `src/database/schema.ts`, then run `yarn drizzle:generate` to create a migration file. Migrations are applied automatically on service startup.

## Telemetry

Exposes Prometheus metrics on `localhost:9464/metrics` including default Node.js metrics.
