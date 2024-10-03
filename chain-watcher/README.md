# Chain Watcher

## Architecture Overview

The following diagram illustrates the high-level architecture and connections between different components of the system:

```mermaid
flowchart TD
    subgraph NestClasses["Nest.js /service"]
        A[NestMicroservice<br><br>Main entry point<br>Initializes components<br>Coordinates services]
        B[ConfigService<br><br>Central config management<br>Provides unified config interface]
        C[AppConfigService<br><br>Manages YAML app config<br>Redis, chain, RPCs, monitoring config sources - repos]
        D[MonitoringConfigService<br><br>Retrieves configs from list of repos]
        E[RedisService<br><br>Implements RedisClient interface<br>Provides Redis operations]
    end

    subgraph ChainWatcherClasses["ChainWatcher /lib"]
        F[ChainWatcher<br><br>Orchestrates monitoring<br>Manages monitors<br>Listens to new blocks]
        G[AbstractMonitor<br><br>Base class for monitors<br>Defines handler interfaces<br>Common monitoring utilities]
        H[ConcreteMonitor<br><br>Specific implementations:<br>- ValidatorMonitor<br>- GovernanceMonitor<br>- TransactionIngressMonitor<br>- TransactionEgressMonitor<br>- BalanceMonitors]
        I[IncidentHandler<br><br>Manages incidents<br>Handles alerting]
        J[ChainWatcherStore<br><br>Manages state persistence<br>Interfaces with Redis]
        K[ConfigProcessor<br><br>Validates config files<br>Transforms config data]
    end

    D --> B
    C --> B
    B --> A
    A --> F
    E --> A
    F --> G
    G --> H
    H --> I
    J --> F
    J --> I

