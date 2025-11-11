[![CircleCI](https://dl.circleci.com/status-badge/img/gh/w3f/monitoring-platform/tree/master.svg?style=svg&circle-token=CCIPRJ_SUB1G4oHMH8XwxjXskW3sc_0c9d235912138f0bba11f4c38895c0a0b30aba97)](https://dl.circleci.com/status-badge/redirect/gh/w3f/monitoring-platform/tree/master)

# Monitoring Platform

The Monitoring Platform provides real-time monitoring of Polkadot, Kusama, and parachains, mostly for security-related events. It is built as a modular system of microservices, including Chain, API, and Matrix services, with distributed configuration across multiple sources and centralized incident management.

## Architecture

```mermaid
graph LR
    %% Core Services
    subgraph Services
        subgraph "Chain services"
            Chain1["<a href='https://github.com/w3f/monitoring-platform/blob/master/packages/chain/README.md' title='Chain Service Documentation'>Chain service</a> 1<br>Polkadot"]:::service
            Chain2["<a href='https://github.com/w3f/monitoring-platform/blob/master/packages/chain/README.md' title='Chain Service Documentation'>Chain service</a> N<br>AssetHub"]:::service
        end
        API["<a href='https://github.com/w3f/monitoring-platform/blob/master/packages/api/README.md' title='API Service Documentation'>API service</a><br>Incident & config management"]:::service
        Matrix["<a href='https://github.com/w3f/monitoring-platform/blob/master/packages/matrix/README.md' title='Matrix Service Documentation'>Matrix service</a><br>Bot & notifications"]:::service
    end
    
    %% External Components
    Postgres[(PostgreSQL<br><br>)]:::database
    
    subgraph "Distributed configuration"
        GitLab1["GitLab repo 1<br><a href='https://github.com/w3f/monitoring-platform/blob/master/packages/config/CONFIG_GUIDE.md' title='Configuration Guide'>config.yaml</a>"]:::config
        GitLab2["GitLab repo N<br><a href='https://github.com/w3f/monitoring-platform/blob/master/packages/config/CONFIG_GUIDE.md' title='Configuration Guide'>config.yaml</a>"]:::config
    end
    
    Room((Matrix Room)):::external
    
    %% Connections with simplified labels
    Chain1 & Chain2 -->|Creates/resolves<br>incidents| API
    Chain1 & Chain2 -.->|Gets config,<br>last block| API
    API -->|Sends notifications| Matrix
    Matrix -->|Gets/acks incidents| API
    Matrix <-->|Two-way communication| Room
    API -.->|Fetches configs| GitLab1 & GitLab2
    API --> Postgres
    
    %% Styling
    classDef service fill:#FFF2CC,stroke:#D6B656,stroke-width:1px
    classDef database fill:#D4E8D4,stroke:#82B366,stroke-width:1px
    classDef config fill:#DAE8FC,stroke:#6C8EBF,stroke-width:1px
    classDef external fill:#F5F5F5,stroke:#666666,stroke-width:1px
```

## Packages

| Package                                       | Role                           | Key features                                              |
|-----------------------------------------------|--------------------------------|-----------------------------------------------------------|
| [**API**](packages/api/README.md)             | Incident & config control      | Incident CRUD API, monitoring config, last block handling |
| [**Chain**](packages/chain/README.md)         | Blockchain monitor             | Balance changes, transfers, identity, voting and more     |
| [**Matrix**](packages/matrix/README.md)       | Notifications & bot            | Deliver/ack incidents via Matrix rooms, bot commands      |
| [**Common**](packages/common/README.md)       | Shared utilities               | Types, constants, utilities, telemetry configuration      |
| [**Config**](packages/config/README.md)       | YAML config & validation       | Load/validate monitoring rules                            |

## Installation & Setup

**Prerequisites:** Node.js 20+, Yarn 4.6+, PostgreSQL

```bash
git clone https://github.com/w3f/monitoring-platform.git
cd monitoring-platform
yarn install
yarn build
```

**Development:**
```bash
yarn start:api:dev
yarn start:chain:dev
yarn start:matrix:dev
```

## Configuration

- **Service config:** Per-package `config/config.yaml` files (connections, runtime params)
- **Monitoring rules:** YAML files defining chains, accounts, thresholds; see [Config Guide](packages/config/CONFIG_GUIDE.md)

## Deployment

- **CI/CD:** CircleCI builds Docker images & Helm charts
- **Helm charts:** Published to W3F Helm repo
- **ArgoCD:** Deploys apps `monitoring-stage`, `monitoring-prod`, `monitoring-oncall`
- **Kubernetes:** Each environment runs in its own namespace

See [Deployment Guide](deployment/README.md) for details.

## Testing

```bash
# Unit tests (per-package tests/ directory)
yarn test

# Integration tests (per-package tests/integration/ directory)  
yarn test:integration
```

**End-to-End tests:** Full flow (Chain → API → Matrix); see [E2E Tests](e2e/README.md)

## Documentation

### Core Services
- [**API Service**](packages/api/README.md) - REST API for incident & config management
- [**Chain Service**](packages/chain/README.md) - Blockchain monitoring service
- [**Matrix Service**](packages/matrix/README.md) - Notifications & bot service

### Supporting Packages
- [**Common Package**](packages/common/README.md) - Shared types, constants, utilities and telemetry
- [**Config Package**](packages/config/README.md) - YAML monitoring config & validation

### Configuration & Monitoring
- [**Config Guide**](packages/config/CONFIG_GUIDE.md) - Monitoring rules configuration
- [**Monitors & Handlers**](packages/config/MONITORS.md) - List of all supported monitors and handlers

### Development & Operations
- [**Deployment Guide**](deployment/README.md) - CI/CD, Helm, ArgoCD, Kubernetes deployment
- [**E2E Tests**](e2e/README.md) - End-to-end testing setup and execution
- [**Development Notes**](docs/NOTES.md) - Architecture, design decisions & known issues
- [**Publishing Guide**](docs/PUBLISHING.md) - NPM package release process
