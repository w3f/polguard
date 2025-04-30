[![CircleCI](https://dl.circleci.com/status-badge/img/gh/w3f/monitoring-platform/tree/master.svg?style=svg&circle-token=CCIPRJ_SUB1G4oHMH8XwxjXskW3sc_0c9d235912138f0bba11f4c38895c0a0b30aba97)](https://dl.circleci.com/status-badge/redirect/gh/w3f/monitoring-platform/tree/master)

# Monitoring Platform

A comprehensive monitoring solution for the Polkadot ecosystem, focusing on real-time detection and alerting.

## Overview

The Monitoring Platform is designed to monitor Polkadot, Kusama, and related parachains, mostly for security-related events. The platform is built as a modular system with several specialized services working together, with the API service serving as the central control point for incident management and configuration.

## Architecture

```mermaid
graph TD
    subgraph "Services"
        API[API Service<br>Central control for incident and configuration management]
        Chain[Chain Service<br>Blockchain monitoring]
        Telemetry[Telemetry Service<br>Node telemetry monitoring]
        Matrix[Matrix Service<br>Notification delivery]
    end

    Chain -- "Create incidents<br>Get monitoring config" --> API
    Telemetry -- "Create incidents<br>Get monitoring config" --> API
    API -- "Send notifications" --> Matrix
    Matrix -- "Acknowledge incidents" --> API
```

## Key Features

- **Chain Monitoring**: Some of the monitoring features include:
  - Account balance tracking and balance transfer detection
  - Cross-chain assets transfers
  - Staking commission changes, slashes, and active set presence
  - Identity changes and verification
  - Referenda and voting activities

- **Flexible Monitoring Configuration**: Define monitoring groups with specific chains, accounts, and alert settings using YAML files stored in the repository

- **Incident Management**: Create, track, acknowledge, and resolve incidents

- **Matrix Integration**: Send notifications to Matrix rooms and interact with a Matrix bot

- **Extensible Architecture**: Modular design allows for adding new monitoring subjects and notification channels

## Packages

### Services

- [**API Service**](packages/api/README.md): Central control service that manages incidents, configurations, and notifications
  - Stores and manages incidents through a REST API
  - Provides centralized monitoring configuration for other services
  - Schedules notification retries and configuration refreshes
  - Handles automatic resolution of orphaned incidents

- [**Chain Service**](packages/chain/README.md): Monitors blockchain activities and generates incidents
  - Processes blockchain events, extrinsic calls and state changes
  - Creates incidents when issues are detected, resolves incidents

- [**Matrix Service**](packages/matrix/README.md): Handles sending notifications to Matrix rooms
  - Delivers incident notifications to Matrix rooms
  - Provides a bot interface for incident management
  - Supports incident acknowledgment via commands

- [**Telemetry Service**](packages/telemetry/README.md): Monitors node telemetry data (short-term solution to be removed in the future)
  - Processes telemetry data, tracks node hardware, software, location information
  - Creates incidents when issues are detected, resolves incidents

### Supporting Packages

- [**Types Package**](packages/types/README.md): Common types, interfaces, and constants used across all packages
  - Defines core data structures and enums
  - Provides type safety and consistency across packages

- [**Config Package**](packages/config/README.md): Monitoring configuration processing and validation
  - Loads and validates YAML monitoring configuration files
  - Transforms raw configuration into structured monitoring groups
  - Provides utilities for address transformation and settings building
  - [Configuration Guide](packages/config/CONFIG_GUIDE.md): Detailed guide to the YAML configuration format
  - [Monitors & Handlers Reference](packages/config/MONITORS.md): Comprehensive list of all monitors and handlers

## Getting Started

### Prerequisites

- Node.js 20+
- Yarn 4.6.0+
- PostgreSQL (persistence for API service)
- Redis

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/w3f/monitoring-platform.git
   cd monitoring-platform
   ```

2. Install dependencies:
   ```bash
   yarn install
   ```

3. Build all packages:
   ```bash
   yarn build
   ```

### Configuration

There are two types of configuration in this project:

1. **Application Configuration**: Each service has its own application configuration file in its `config` directory. These files configure the service's behavior, connections, and runtime parameters.

2. **Monitoring Configuration**: Separate from application configuration, this defines what to monitor (accounts, chains, thresholds, etc.) and is processed by the Config package and served by the API service.

Example application configurations can be found in the `config` directory of each package.

### Running Services

Start individual services in development mode:

```bash
# Start API service
yarn start:api:dev

# Start Chain service
yarn start:chain:dev

# Start Matrix service
yarn start:matrix:dev
```

For more details on configuring and running each service, refer to the README in each service's package directory.

### Deployment

The project includes deployment configurations in the `deployment` folder:

- Docker Compose setup for local development
- Helm charts for Kubernetes deployment

For more details on deployment options, see the [Deployment Guide](deployment/README.md).

## Development

For development guidelines and notes, see the [Development Notes](docs/DEVELOPMENT.md).

For information on publishing packages, see the [Publishing Guide](docs/PUBLISHING.md).
