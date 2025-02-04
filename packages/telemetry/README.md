# Telemetry Exporter

A service that exports Polkadot and Kusama node telemetry data with location enrichment.

## Architecture

The service is split into two main parts:

### Core business logic (lib/)
- `telemetry-exporter.ts`: Framework-independent business logic for telemetry handling
  - Node filtering based on monitoring configuration
  - Location data enrichment and caching
  - Telemetry client management

### Service layer (service/)
- NestJS-specific code for exposing functionality via HTTP
- Endpoints:
  - `/feed`: Get current node states for Polkadot and Kusama
  - `/health`: Service health check
  - `/metrics`: Prometheus metrics

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

The service requires a configuration file at `config/config.yaml` with:

```yaml
redis:
  url: redis://localhost:6379/0  # Redis connection URL

ipinfo:
  token: your-ipinfo-token      # IPInfo API token for location data
  cache_ttl: 43200             # Cache TTL in seconds (default: 12 hours)

monitoring_config_sources:      # Sources for monitoring configuration
  - name: source-name
    url: https://example.com/config
    auth_token: optional-token
```

## API

### GET /feed
Returns node states for both Polkadot and Kusama networks:
```json
{
  "polkadot": [
    {
      "id": 123,
      "name": "validator-node-east",
      "implementation": "Parity Polkadot",
      "version": "0.9.42",
      "validator": "14Uu59k5VLBz3zLPuqwR6yUbqJGrQxQFcXJpc9GNU7NSFJat",
      "networkInfo": {
        "peerId": "12D3KooWBmAwcd4PJNJvfV89HwE48nwkRmAgo8Vy3uQEyNNHBox2",
        "peerCount": 85,
        "ip": "203.0.113.1"
      },
      "systemInfo": {
        "cpu": "AMD Ryzen 9 5950X",
        "memory": 68719476736,
        "coreCount": 32,
        "isVirtualMachine": false
      },
      "location": {
        "city": "Frankfurt",
        "provider": "Amazon AWS",
        "latitude": 50.1109,
        "longitude": 8.6821
      },
      "block": {
        "height": 17382019,
        "hash": "0x6d6f7c5c8e7d6f5e4d3c2b1a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e",
        "propagationTime": 752
      }
    }
  ],
  "kusama": [
    {
      "id": 456,
      "name": "archive-node-west",
      "implementation": "Parity Polkadot",
      "version": "0.9.42",
      "networkInfo": {
        "peerId": "12D3KooWQYV9dGMFoRzNStwpXztXaBUjtPqi6aU76ZgUriHhKust",
        "peerCount": 92,
        "ip": "203.0.113.2"
      },
      "systemInfo": {
        "cpu": "Intel Xeon E5-2686 v4",
        "memory": 137438953472,
        "coreCount": 16,
        "isVirtualMachine": true
      },
      "location": {
        "city": "Singapore",
        "provider": "Digital Ocean",
        "latitude": 1.3521,
        "longitude": 103.8198
      }
    }
  ]
}
```

### GET /health
Returns 200 OK if service is healthy

### GET /metrics
Returns Prometheus metrics with default Node.js metrics
