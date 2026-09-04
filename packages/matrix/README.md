# @w3f/polguard-matrix

The Matrix service is PolGuard's bot in Matrix. It logs in as a Matrix user, posts the messages other services hand it over HTTP into the rooms they name, and answers commands typed in those rooms: acknowledging, listing, querying and resolving incidents through the Incident service.

The Incident service is the main source of messages. The Payouts service and Prometheus Alertmanager can post through the same endpoints.

## API Endpoints

The target room is part of the URL: a Matrix room id such as `!abc:example.org`, URL-encoded. Room aliases are not accepted.

- `POST /notifications/:roomId` — body `{ "message": "<html>" }`, delivered as is
- `POST /notifications/:roomId/alertmanager` — an [Alertmanager webhook payload](https://prometheus.io/docs/alerting/latest/configuration/#webhook_config), rendered in the incident message layout
- `GET /health` — Health check

Delivery failures answer 502; invalid input answers 400. There is no authentication: the service is meant to be reachable only inside the cluster.

## Bot Commands

Available when `incidents.url` is configured. Without it the service does not read room messages at all and only sends.

### Core Commands
- `!show <id>` — Show incident message for specific incident
- `!ack <id>` — Acknowledge incident by ID
- `!unacked` — List incidents requiring acknowledgment for this room
- `!unresolved` — List unresolved incidents (ongoing onchain conditions) for this room
- `!resolve <id|ALL>` — Resolve incident manually by ID or resolve all unresolved incidents
- `!manual` — Show comprehensive user manual with workflow processes
- `!help` — Show help message with all available commands

### Debug Commands
- `!query [filters...]` — Query incidents with custom filters
  - Available filters: `account`, `groupId`, `handlerType`, `chain`, `createdAfter`, `createdBefore`, `isResolved`, `isAcked`, `needsAck`
  - Example: `!query createdAfter=2025-01-01 isResolved=false`
  - Boolean filters accept `true` or `false` values
  - Date filters accept ISO date format (e.g., `2025-01-01` or `2025-01-01T10:30:00Z`)
- `!debug <id>` — Show detailed debug information about specific incident

## Configuration

Configured via `config/config.yaml`; see [config.yaml.example](./config/config.yaml.example) for
every option — comments there cover defaults, required vs. optional fields, allowed values, and
env-var overrides.

The `incidents.url` field points at the Incident service API — see
[packages/incident/README.md](../incident/README.md) for its contract.

### Authentication & encryption

The bot supports two mutually exclusive auth modes:

- **`passwordAuth`**: logs in fresh on each start and communicates over end-to-end encryption. Provide the password via `MATRIX_PASSWORD`. To avoid clients flagging the bot's messages as *"Encrypted by a device not verified by its owner"*, also set `MATRIX_RECOVERY_KEY` — the account's Secure Backup (4S) recovery key, created once in a client such as Element.
- **`tokenAuth`** (dev/CI flow): reuses a fixed session (`accessToken` + `deviceId`) and runs in plaintext — no encryption, no device pruning, and no recovery key needed. The access token can also be provided via `MATRIX_TOKEN`.

### Devices

Each start with `passwordAuth` creates a new Matrix device. `matrix.pruneDevicesLabeled` is any label you choose: the new device is registered under it, and on startup the account's other devices with the same label are deleted. Several instances can share one account, each cleaning up only its own predecessors.

## Telemetry

Exposes Prometheus metrics on `localhost:9464/metrics` including default Node.js metrics.

## Development

```bash
# Build
yarn build

# Run in development mode (watches dist/, rebuild after source changes)
yarn start:dev

# Run in production mode
yarn start

# Run tests
yarn test
yarn test:watch
yarn test:cov
```