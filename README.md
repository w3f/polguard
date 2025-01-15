[![CircleCI](https://dl.circleci.com/status-badge/img/gh/w3f/monitoring-platform/tree/master.svg?style=svg&circle-token=CCIPRJ_SUB1G4oHMH8XwxjXskW3sc_0c9d235912138f0bba11f4c38895c0a0b30aba97)](https://dl.circleci.com/status-badge/redirect/gh/w3f/monitoring-platform/tree/master)

# Monitoring Platform

## Overview

The platform consists of microservices and shared packages:

### Microservices (Private)
1. **@w3f/monitoring-chain-watcher** - Monitoring service responsible for observing blockchain activities and generating incidents. [More details](./packages/chain-watcher/README.md)
2. **@w3f/monitoring-matrix** - Notification service for sending alerts and updates to specified channels. [More details](./packages/matrix/README.md)
3. **@w3f/monitoring-incident-management** - _(Draft)_ API gateway service for managing and coordinating incidents across the platform. Basic project structure is set up, but the service is in early development stage. [More details](./packages/incident-management/README.md)

All services are built with Nest.js, supporting both synchronous and asynchronous communication using Redis Streams.

### Shared Packages (Public)
1. **@w3f/monitoring-types** - Common types and interfaces used across the platform
2. **@w3f/monitoring-config** - Configuration processing package, provides YAML configuration validation and transformation, chain-specific address formatting, and decimal balance conversion support. [More details](./packages/config/README.md)

## Documentation

### User Documentation
- [Monitors & Handlers Reference](./docs/MONITORS.md) - Comprehensive guide to available monitors and their handlers
- [Configuration Guide](./docs/CONFIG.md) - Detailed instructions for creating YAML configuration files

### Technical Documentation
- [ChainWatcher service](./packages/chain-watcher/README.md)
- [Matrix service](./packages/matrix/README.md)
- [Config package](./packages/config/README.md)
- [Development Notes](./docs/DEVELOPMENT.md) - Project structure, architectural decisions, and roadmap
- [Publishing Guide](./docs/PUBLISHING.md) - Instructions for building and publishing packages

## Architecture Overview

```mermaid
flowchart LR
    CW[1 - ChainWatcher]
    M[2 - Matrix]
    IM[3 - Incident Management]
    RS[(Redis Streams)]
    RKV[(Redis Key/Value)]
    DB[(PostgreSQL)]

    CW --> RKV
    M --> |HTTP sync| IM
    RS --> |async| M
    RS --> |async| IM
    IM --> DB
    subgraph Events
        IC([Incident.Created])
        IR([Incident.Resolved])
    end
    CW --> IC
    CW --> IR
    IC --> RS
    IR --> RS

    style CW stroke:#c68c8c,stroke-width:3px,font-weight:bold
    style M stroke:#8cc68c,stroke-width:3px,font-weight:bold
    style IM stroke:#8c8cc6,stroke-width:3px,font-weight:bold
```

## Quick Start

There are at least two ways to run the monitoring platform:

### 1. Running ChainWatcher only (development)

This is the simplest way to start development or testing:

1. Create your monitoring configuration:
   - Create a YAML file following the [Configuration Guide](./docs/CONFIG.md)
   - Place it in `packages/chain-watcher/monitoring-configs/`

2. Set up application config:
   - Create configuration file for the service
   - Place it in `packages/chain-watcher/config/`

3. Start Redis:
   ```bash
   cd deployment
   docker-compose up redis
   ```

4. Run the Chain Watcher:
   ```bash
   yarn build:all # First time only
   yarn start:chain-watcher:dev
   ```

### 2. Using docker-compose

This approach runs all services with Redis streams and Matrix notifications:

1. Set up configurations in `deployment/app-config/`:
   - `chain-watcher.yaml` - ChainWatcher service configuration
   - `chain-watcher.monitoring.yaml` - Monitoring configuration
   - `matrix.yaml` - Matrix service configuration

2. Set Matrix password:
   ```bash
   export MATRIX_PASSWORD=your_password
   ```

3. Start all services:
   ```bash
   cd deployment
   docker-compose up
   ```

## Development Workflow

When working with local changes:

```bash
# Build all packages
yarn build:all

# Or build specific package in case of changes
yarn build:types
yarn build:config
yarn build:chain-watcher
yarn build:matrix

# Run services
yarn start:chain-watcher:dev
yarn start:matrix:dev
```

## Links

- [Project Timeline](https://docs.google.com/spreadsheets/d/1twBMKTNauqBwBL2ZccdGFIPfVOj8efJolkUCv-wWvgQ)
- [Architecture Discussion](https://github.com/w3f/SecOps/issues/599)