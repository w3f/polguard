# @w3f/polguard-matrix

The Matrix service delivers incident notifications to Matrix rooms and provides a bot interface for incident management. It receives notification requests from the Incident service and enables team interaction via bot commands.

## Key Features

- **Notification Delivery**: Sends incident notifications to Matrix rooms
- **Bot Commands**: Interactive incident management via Matrix chat
- **Incident Acknowledgment**: Allows users to acknowledge incidents directly from Matrix
- **Incident Queries**: Support for querying and debugging incidents

## API Endpoints

### Notifications
- `POST /notifications` — Send notification to Matrix room

### Health
- `GET /health` — Health check

## Bot Commands

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

Rooms are joined automatically when the bot is invited — there is no room list to configure. The
`incidents.url` field points at the Incident service API — see
[packages/incident/README.md](../incident/README.md) for its contract.

### Authentication & encryption

The bot supports two mutually exclusive auth modes:

- **`passwordAuth`**: logs in fresh on each start and communicates over end-to-end encryption. Provide the password via `MATRIX_PASSWORD`. To avoid clients flagging the bot's messages as *"Encrypted by a device not verified by its owner"*, also set `MATRIX_RECOVERY_KEY` — the account's Secure Backup (4S) recovery key, created once in a client such as Element.
- **`tokenAuth`** (dev/CI flow): reuses a fixed session (`accessToken` + `deviceId`) and runs in plaintext — no encryption, no device pruning, and no recovery key needed. The access token can also be provided via `MATRIX_TOKEN`.

Set the top-level `matrix.pruneOtherDevices: true` to delete the account's other devices on startup (opt-in, default off)

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