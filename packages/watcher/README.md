# Watcher

## Architecture Overview

The following diagram illustrates the high-level architecture and connections between different components of the system:

```mermaid
flowchart RL
    subgraph NestClasses["Nest.js /service"]
        A[NestMicroservice<br><br>Main entry point. Initializes components, coordinates services]
        B[ConfigService<br><br>Provides unified config interface]
        C[AppConfigService<br><br>Validates config]
        D[MonitoringConfigService<br><br>Retrieves, validates and transforms configs]
        E[StorageService<br><br>Implements KeyValueStorageClient interface, provides Redis operations]
        F[HealthController<br><br>Provides health check endpoint]
        G[MetricsController<br><br>Exposes Prometheus metrics]
        I[IncidentPublisherService<br><br>Implements EventEmitterClient interface, publishes incidents to Redis Stream]
    end

    subgraph WatcherClasses["Watcher /lib"]
        subgraph Common["Common"]
            K[AbstractWatcher<br><br>Base class for watchers. Defines monitor initialization and lifecycle management]
            L[AbstractMonitor<br><br>Base class for monitors. Defines handler management and account lookups]
            M[Store<br><br>Provides namespaced storage for caching and persistence]
            N[IncidentHandler<br><br>Manages incidents state and emission]
        end

        subgraph Chain["Chain"]
            O[ChainWatcher<br><br>Processes blocks, events, and calls]
            P[AbstractChainMonitor<br><br>Base class for chain monitors]
            Q[ChainMonitors<br><br>Specific implementations:<br>- StakingMonitor<br>- GovernanceMonitor<br>- IdentityMonitor<br>- BalancesMonitor]
            R[ChainDataProvider<br><br>Provides cached chain state queries]
        end

        subgraph Telemetry["Telemetry (TODO)"]
            S[TelemetryWatcher<br><br>Processes telemetry updates]
            T[TelemetryMonitor<br><br>Monitors node metrics]
        end
    end

    D --> B
    C --> B
    B --> A
    E --> A
    F --> A
    G --> A
    I --> A

    K --> A
    O --> K
    S -.-> K
    L --> K
    P --> L
    Q --> P
    T -.-> L
    M --> K
    N --> K
    R --> O
```

### Connection Types
- Solid line (`-->`) : Direct dependency/method calls
- Dotted line (`-.->`) : Planned/future components

### Components Overview

#### Common Infrastructure
- **AbstractWatcher**: Generic base for all watchers, handles monitor initialization and lifecycle
- **AbstractMonitor**: Generic base for all monitors, provides handler management and account lookups
- **Store**: Key-value storage for caching and persistence
- **IncidentHandler**: Manages and emits monitoring incidents

#### Chain Monitoring
- **ChainWatcher**: Processes blockchain data (blocks, events, calls)
- **AbstractChainMonitor**: Base for chain-specific monitors
- **Chain Monitors**: Specific implementations for different monitoring needs
- **ChainDataProvider**: Cached access to chain state

#### Telemetry Monitoring (Planned)
- **TelemetryWatcher**: Will process node telemetry data
- **TelemetryMonitor**: Will monitor node metrics

### Data Flow
1. Watcher initializes with appropriate configuration and dependencies
2. Monitors are created based on configuration
3. Chain/Telemetry data is processed through respective watchers
4. Incidents are managed and emitted through IncidentHandler
5. Data is cached/persisted through Store
6. Metrics and health status are exposed via controllers
