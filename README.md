[![CircleCI](https://dl.circleci.com/status-badge/img/gh/w3f/monitoring-platform/tree/master.svg?style=svg&circle-token=CCIPRJ_SUB1G4oHMH8XwxjXskW3sc_0c9d235912138f0bba11f4c38895c0a0b30aba97)](https://dl.circleci.com/status-badge/redirect/gh/w3f/monitoring-platform/tree/master)

# Monitoring Platform

## Overview

The Monitoring Platform consists of three microservices:

1. **ChainWatcher** - Monitoring service responsible for observing blockchain activities and generating incidents. [More details](./packages/chain-watcher/README.md)
2. **Matrix** - Notification service for sending alerts and updates to specified channels. [More details](./packages/matrix/README.md)
3. **Incident Management** - API gateway service for managing and coordinating incidents across the platform. (Planned)

All services are built with Nest.js, supporting both synchronous and asynchronous communication using Redis Streams.

## Project Structure

The project follows a microservices architecture with services organized in the `packages/` directory. For detailed information about project structure, architectural decisions, and development roadmap, see [DEVELOPMENT.md](./docs/DEVELOPMENT.md).

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

## Documentation

- [Development Notes](./docs/DEVELOPMENT.md) - Project structure, architectural decisions, and roadmap
- [Chain Watcher](./packages/chain-watcher/README.md) - Chain monitoring service details
- [Matrix](./packages/matrix/README.md) - Notification service details

## Links

- [Project Timeline](https://docs.google.com/spreadsheets/d/1twBMKTNauqBwBL2ZccdGFIPfVOj8efJolkUCv-wWvgQ)
- [Architecture Discussion](https://github.com/w3f/SecOps/issues/599)