# @w3f/polguard-incident

The Incident service manages incident lifecycle, state persistence, and notification delivery. It provides a REST API for incident creation, acknowledgment, and resolution, serving as the central coordination point in Platform Mode.

## Key Features

- **Incident Management**: Creates, tracks, and resolves incidents with PostgreSQL persistence
- **Last Block Tracking**: Stores last processed block for each chain to enable Chain service resume
- **Notification Scheduling**: Coordinates notification delivery, retries, and escalations
- **Scheduled Maintenance**: Handles incident escalations and auto-resolves stale incidents past a configurable timeout
- **Channel-based authorization**: acknowledge and resolve-manual requests are only accepted from a `channelId` that already has a notification tied to the incident
- **Idempotency**: incident creation deduplicates on `(idempotencyKey, isResolved)`

## API Endpoints

### Incidents
- `POST /incidents` — Create new incident
- `GET /incidents` — List incidents with filters
- `GET /incidents/:id` — Get incident details
- `POST /incidents/:id/acknowledge` — Acknowledge incident
- `POST /incidents/:id/resolve` — Resolve incident (chain service)
- `POST /incidents/:id/resolve-manual` — Resolve incident (manual via bot)

### Last Block Management
- `GET /last-block/:chain` — Get last processed block for chain
- `PUT /last-block/:chain` — Update last processed block for chain

### Other
- `GET /health` — Health check
- `GET /docs` — Swagger UI

## Configuration

Configured via `config/config.yaml`; see [config.yaml.example](./config/config.yaml.example) for
every option — comments there cover defaults, required vs. optional fields, allowed values, and
env-var overrides.

Notifications currently only support Matrix — Slack and Telegram are defined in the shared types
but have no delivery adapter yet.

## Telemetry

Exposes Prometheus metrics on `localhost:9464/metrics` including default Node.js metrics.

## Development

```bash
# Start local Postgres (for manual development)
bash scripts/reset-test-db.sh

# Build and run
yarn build
yarn start
yarn start:dev # watch mode

# Run tests (unit)
yarn test
yarn test:watch
yarn test:cov

# Run integration tests (requires Docker — uses Testcontainers to spin up PostgreSQL automatically)
yarn test:integration
```

**Schema changes:** edit `src/database/schema.ts`, then run `yarn drizzle:generate` to create a migration file. Migrations are applied automatically on service startup.
