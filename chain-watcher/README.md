# Chain Watcher

## Architecture Overview

The following diagram illustrates the high-level architecture and connections between different components of the system:

```mermaid
flowchart TD
    subgraph NestClasses["Nest.js /app"]
        A[NestMicroservice<br><br>Main entry point<br>Initializes components<br>Coordinates services]
        B[ConfigService<br><br>Central config management<br>Provides unified config interface]
        C[AppConfigService<br><br>Manages YAML app config<br>Redis, chain, RPCs, monitoring config sources - repos]
        D[MonitoringConfigService<br><br>Retrieves configs from list of repos]
        E[RedisService<br><br>Implements RedisClient interface<br>Provides Redis operations]
    end

    subgraph ChainWatcherClasses["ChainWatcher /core"]
        F[ChainWatcher<br><br>Orchestrates monitoring<br>Manages monitors<br>Listens to new blocks]
        G[AbstractMonitor<br><br>Base class for monitors<br>Defines handler interfaces<br>Common monitoring utilities]
        H[ConcreteMonitor<br><br>Specific implementations:<br>- ValidatorMonitor<br>- GovernanceMonitor<br>- TransactionIngressMonitor<br>- TransactionEgressMonitor<br>- BalanceMonitors]
        I[ReconnectableApi<br><br>Resilient RPC connection<br>Automatic reconnection<br>Manages multiple RPC endpoints]
        J[ConfigProcessor<br><br>Validates config files<br>Transforms config data]
        K[IncidentHandler<br><br>Manages incidents<br>Handles alerting]
        L[ChainWatcherStore<br><br>Manages state persistence<br>Interfaces with Redis<br>Emits events]
    end

    M[Event Consumers<br><br>Other services<br>consuming events]

    A --> F
    A --> B
    A --> E
    B --> C
    B --> D
    D --> J
    C --> D
    F --> G
    G --> H
    I --> F
    H --> K
    F --> L
    K --> L
    E --> L
    L --> M