# @w3f/monitoring-types

Common types, interfaces and constants used across W3F monitoring packages:
- @w3f/monitoring-chain
- @w3f/monitoring-telemetry
- @w3f/monitoring-matrix
- @w3f/monitoring-config

## Installation

```bash
yarn add @w3f/monitoring-types
```

## Usage

```typescript
import { Chain, MonitoringGroup, AlertSettings } from '@w3f/monitoring-types';

// Use enums
const chain = Chain.Polkadot;

// Use interfaces
const group: MonitoringGroup = {
  name: 'Validator Group',
  chain: Chain.Polkadot,
  alerts: {
    messengerType: 'matrix',
    targets: ['room-id']
  }
  // ...
};
```