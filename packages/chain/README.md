# @w3f/monitoring-chain

The Chain service monitors blockchain activities and generates or resolves incidents based on detected conditions. It processes blockchain events, extrinsic calls, and state changes across Polkadot ecosystem chains.

## Key Features

- **One-Time & Ongoing Incidents**: Supports both event-based incidents and continuous state monitoring with automatic resolution
- **Multi-Chain Support**: Monitor any Polkadot SDK-based blockchain
- **Flexible Architecture**: Configurable store (in-memory, file, service) and incident reporters (stdout, webhook, service)
- **Comprehensive Monitoring**: Tracks balances, staking, governance, identity, assets, and XCM transfers

See [Monitors & Handlers Reference](../config/MONITORS.md) for complete list of monitoring capabilities.

## Architecture

```mermaid
graph TB
    %% External
    Blockchain[("Blockchain<br>(RPC)")]:::blockchain
    Config["<a href='../config/CONFIG_GUIDE.md'>Monitoring Config</a><br>(YAML)"]:::config
    
    %% Core Processing
    subgraph Processing ["Block Processing"]
        Watcher["Watcher<br>(Subscribe & Process Blocks)"]:::component
        DataProvider["Data Provider<br>(Cached Chain Queries)"]:::component
        Monitors["Monitors<br>(Balances, Staking, Governance,<br>Identity, Assets, XCM)"]:::component
    end
    
    %% Incident Management
    IncidentHandler["Incident Handler<br>(Incident Lifecycle)"]:::component
    
    %% Abstractions
    subgraph Store ["Store"]
        StoreImpl["In-Memory / File / Service"]:::impl
    end
    
    subgraph Reporter ["Reporter"]
        ReporterImpl["Stdout / Webhook / Service"]:::impl
    end
    
    %% Connections
    Blockchain -->|"Subscribes to<br>finalized blocks"| Watcher
    Config -.->|"Loads rules"| Watcher
    Watcher -->|"Distributes<br>events/calls/state"| Monitors
    Monitors -->|"Query chain state"| DataProvider
    DataProvider -->|"Cache queries"| Store
    Monitors -->|"Create/resolve<br>incidents"| IncidentHandler
    IncidentHandler -->|"Track incident state"| Store
    IncidentHandler -->|"Send incidents"| Reporter
    
    %% Styling
    classDef blockchain fill:#E1D5E7,stroke:#9673A6,stroke-width:2px
    classDef component fill:#FFF2CC,stroke:#D6B656,stroke-width:2px
    classDef impl fill:#DAE8FC,stroke:#6C8EBF,stroke-width:1px
    classDef config fill:#F8CECC,stroke:#B85450,stroke-width:1px
```

**Key Components:**
- **Watcher**: Subscribes to blocks, processes them sequentially, and distributes events/calls/state to monitors
- **Monitors**: Analyze blockchain data and decide when to create or resolve incidents
- **Data Provider**: Provides cached access to chain state queries
- **Incident Handler**: Manages incident lifecycle (creation/resolution) and tracks ongoing incident state
- **Store**: Persists last block, incident state, and caches chain queries
- **Reporter**: Outputs incidents to configured destination

## API Endpoints

- `GET /health` - Health check

## Configuration

The service is configured via `config/config.yaml`. Key configuration areas:

- **Chain**: RPC URL, starting block, chain name (e.g., AssetHubPolkadot)
- **Store**: Type (inMemory/file/service) and connection details
- **Incident Reporter**: Type (stdout/webhook/service) and connection details
- **Monitoring Configs**: Directory path for YAML monitoring rules

See [config.yaml.example](./config/config.yaml.example) for complete configuration options.

## Telemetry

Exposes Prometheus metrics on `localhost:9464/metrics`:

- `latest-block-on-chain`
- `last-block-processed`
- `current-block-processing`
- `block-processing-time`
- `total-groups`
- `total-accounts`
- `total-monitors`

## Development

```bash
# Run in development mode
yarn start:dev

# Run tests
yarn test
yarn test:integration
```