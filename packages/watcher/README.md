# Watcher

## Architecture Overview

The watcher package implements monitoring functionality for both on-chain and off-chain data through a hierarchical class structure.

### Class Hierarchy

#### Base Classes (Common)
- **AbstractWatcher**: Base class for all watchers
  - Handles monitor initialization and lifecycle management
  - Extended by ChainWatcher and TelemetryWatcher
- **AbstractMonitor**: Base class for all monitors
  - Provides handler management and account lookups
  - Extended by chain and telemetry monitors
- **Store**: Provides namespaced storage operations
- **IncidentHandler**: Manages incidents state and emission

#### Chain Monitoring
- **ChainWatcher** (extends AbstractWatcher)
  - Processes blocks, events, and calls
  - Uses ChainDataProvider for cached chain state
- **AbstractChainMonitor** (extends AbstractMonitor)
  - Base for chain-specific monitors
  - Implemented by:
    - **StakingMonitor**: Commission rates, self-stake amounts, reward destination, active set presence
    - **IdentityMonitor**: On-chain identity fields, registration status
    - **BalancesMonitor**: Account balances, transfers, thresholds
    - **GovernanceMonitor**: Governance participation (planned)

#### Telemetry Monitoring
- **TelemetryWatcher** (extends AbstractWatcher)
  - Processes telemetry updates
  - Manages telemetry data collection
- **AbstractTelemetryMonitor** (extends AbstractMonitor)
  - Base for telemetry-specific monitoring
  - Implemented by **TelemetryMonitor**:
    - Hardware requirements (CPU, memory, cores)
    - Location restrictions (countries, regions)
    - Cloud provider verification
    - Client version compliance
    - IP spoofing detection
    - Telemetry data availability

### Service Layer (Nest.js)
- **NestMicroservice**: Main entry point
- **ConfigService**: Configuration interface
- **AppConfigService**: Config validation
- **MonitoringConfigService**: Config processing
- **StorageService**: Redis operations
- **HealthController**: Health checks
- **MetricsController**: Prometheus metrics
- **IncidentPublisherService**: Redis Stream publishing

### Data Flow
1. Watcher initializes with configuration and dependencies
2. Monitors are created based on configuration
3. Chain/Telemetry data is processed through respective watchers
4. Incidents are managed and emitted through IncidentHandler
5. Data is cached/persisted through Store
6. Metrics and health status are exposed via controllers
