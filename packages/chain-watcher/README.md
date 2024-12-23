# Chain Watcher

## Architecture Overview

The following diagram illustrates the high-level architecture and connections between different components of the system:

```mermaid
flowchart RL
    subgraph NestClasses["Nest.js /service"]
        A[NestMicroservice<br><br>Main entry point. Initializes components, coordinates services]
        B[ConfigService<br><br>Provides unified config interface]
        C[AppConfigService<br><br>Validates config]
        D[MonitoringConfigService<br><br>Retrieves, validates and transforms configs]
        E[StorageService<br><br>Implements StorageClient interface, provides Redis operations]
        F[HealthController<br><br>Provides health check endpoint]
        G[MetricsController<br><br>Exposes Prometheus metrics]
        I[IncidentPublisherService<br><br>Implements EventEmitterClient interface, publishes incidents to Redis Stream]
    end

    subgraph ChainWatcherClasses["ChainWatcher /lib"]
        J[ChainWatcher<br><br>Orchestrates monitoring, listens to new blocks]
        K[AbstractMonitor<br><br>Base class for monitors. Defines handler interfaces, common monitoring utilities]
        L[ConcreteMonitor<br><br>Specific implementations:<br>- GovernanceMonitor<br>- ValidatorMonitor<br>- TransactionIngressMonitor<br>- TransactionEgressMonitor<br>- BalanceDecrementMonitor<br>- BalanceIncrementMonitor<br>- BalanceThresholdMonitor]
        M[IncidentHandler<br><br>Track ongoing incidents, using thresholds to emit/resolve them. Support periodic re-emission of unresolved and handle one-time incidents.]
        N[ChainWatcherStore<br><br>Stores and retrieve account balances, tracks the last processed block, manages active incidents]
        O[ConfigProcessor<br><br>Validates and transforms monitoring config files]
    end

    D --> B
    C --> B
    B --> A
    E -.-> N
    E --> A
    E -.-> M
    I --> A
    F --> A
    G --> A

    J ==> A
    K --> J
    L --> K
    M --> J
    N --> J
    N --> M
    O ==> D
    I -.-> M
```

### Connection Types
- Solid line (`-->`) : Direct dependency/method calls
- Dotted line (`-.->`) : Data access/persistence
- Double line (`==>`) : Configuration/initialization flow

### Data Flow
1. ConfigProcessor validates configs which are served via MonitoringConfigService
2. ChainWatcher initializes monitors based on configuration
3. Monitors process new blocks and report to IncidentHandler
4. IncidentHandler uses StorageService for persistence and publishes through IncidentPublisherService
5. MetricsController exposes:
   - Standard Prometheus metrics (memory, CPU, etc.)
   - Custom metrics (latest block height, monitoring status)
6. HealthController provides liveness/readiness probes for Kubernetes health checks
