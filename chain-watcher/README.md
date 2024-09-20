# Chain Watcher

## Project Structure

This project is structured into two main parts:

1. **app folder**: Contains all Nest.js related code, including:
   - Microservice setup and configuration
   - Controllers for handling incoming requests
   - Nest-specific services (ConfigService, BlockTrackerService, etc.)
   - Dependency injection and module definitions
   - Integration with RabbitMQ for inter-service communication

2. **core folder**: Houses the core Chain Watcher functionality, including:
   - Main ChainWatcher class for orchestrating the monitoring process
   - Abstract and concrete monitor implementations (Validator, Governance, Transaction, etc.)
   - ReconnectableApi for resilient blockchain communication
   - ConfigProcessor for handling and validating configuration files
   - Utility functions and shared interfaces

## Architecture Overview

The following diagram illustrates the high-level architecture and connections between different components of the system:

```mermaid
flowchart TD
    subgraph NestClasses["Nest.js Classes /app"]
        A[NestMicroservice<br><br>Main entry point<br>Initializes components<br>Coordinates services]
        B[ConfigService<br><br>Central config management<br>Delegates to specific services<br>Provides unified config interface]
        C[AppConfigService<br><br>Manages YAML app config<br>DB, RabbitMQ, chain, RPCs<br>Supports environment-specific configs]
        D[MonitoringConfigService<br><br>Retrieves configs from repos<br>Manages config versioning<br>Uses AppConfig for repo info]
        E[BlockTrackerService<br><br>Tracks processed blocks<br>Uses ORM for persistence<br>Prevents missed/duplicate blocks]
    end

    subgraph ChainWatcherClasses["ChainWatcher Classes /core"]
        F[ChainWatcher<br><br>Orchestrates monitoring<br>Manages monitors<br>Processes blockchain data]
        G[AbstractMonitor<br><br>Base class for monitors<br>Defines handler interfaces<br>Common monitoring utilities]
        H[ConcreteMonitor<br><br>Specific implementations:<br>- ValidatorMonitor<br>- GovernanceMonitor<br>- TransactionIngressMonitor<br>- TransactionEgressMonitor]
        I[ReconnectableApi<br><br>Resilient RPC connection<br>Automatic reconnection<br>Manages multiple endpoints]
        J[ConfigProcessor<br><br>Validates config files<br>Transforms config data<br>Ensures backwards compatibility]
    end

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