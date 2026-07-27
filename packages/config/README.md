# @w3f/polguard-config

The Config package is responsible for loading, validating, and processing monitoring configuration files from the local filesystem. It transforms YAML configurations into structured monitoring groups that can be used by the monitoring services.

## Documentation

- [Configuration Guide](CONFIG_GUIDE.md) — Detailed guide to the YAML configuration format
- [Monitors & Handlers Reference](MONITORS.md) — Comprehensive list of all monitors and handlers

## Components

### ConfigProcessor

Internal component for processing configuration files:
- Loads and validates YAML configuration files
- Applies default settings when not explicitly provided
- Creates separate group for each chain configuration
- Transforms addresses to chain-specific SS58 format
- Merges monitor-level settings and account-level settings
- Converts decimal balance strings to chain-specific BigInt values

### ConfigValidator

Performs validation of raw configuration data:
- Ensures proper structure and required fields
- Validates field formats and values
- Checks cross-field dependencies

### AccountSettingsBuilder

Builds account monitor settings by:
- Combining monitor and account-level configurations
- Applying defaults for missing settings
- Converting decimal balances to BigInt values

### AddressTransformer

Handles blockchain address transformations:
- Converts between hex and SS58 formats
- Ensures correct chain-specific encoding

## Installation

```bash
yarn add @w3f/polguard-config
```

## Usage

```typescript
import { getMonitoringGroups } from '@w3f/polguard-config';
import { Chain } from '@w3f/polguard-common';

// Load monitoring groups for a specific chain from local filesystem
const groups = await getMonitoringGroups(Chain.Polkadot, './config-dir', logger);
```

**Note:** The config directory must exist on the local filesystem and contain `.yaml` files.
