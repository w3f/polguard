[![CircleCI](https://dl.circleci.com/status-badge/img/gh/w3f/monitoring-platform/tree/master.svg?style=svg&circle-token=CCIPRJ_SUB1G4oHMH8XwxjXskW3sc_0c9d235912138f0bba11f4c38895c0a0b30aba97)](https://dl.circleci.com/status-badge/redirect/gh/w3f/monitoring-platform/tree/master)

# Monitoring Platform

## Overview

The Monitoring Platform consists of three microservices:

1. **ChainWatcher** - Monitoring service responsible for observing blockchain activities and generating incidents. [More details](./chain-watcher/README.md)
2. **Matrix** - Notification service for sending alerts and updates to specified channels. [More details](./matrix/README.md)
3. **Incident Management** - API gateway service for managing and coordinating incidents across the platform.

All services are built with Nest.js, supporting both synchronous and asynchronous communication using Redis Streams.

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

## Links

- [Project Timeline](https://docs.google.com/spreadsheets/d/1twBMKTNauqBwBL2ZccdGFIPfVOj8efJolkUCv-wWvgQ)
- [Architecture Discussion](https://github.com/w3f/SecOps/issues/599)
