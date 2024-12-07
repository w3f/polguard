# Configuration Module

This directory contains the configuration processing and validation logic for the Chain Watcher application.

## Components

### 1. Config Processor (`config-processor.ts`)

The Config Processor is responsible for loading, processing, and transforming raw configuration data into structured monitoring groups.

Key features:
- Loading and validating configuration files
- Applying defaults from the default group if chains, monitors or alerts were not provided
- Building account settings by merging monitor configs with account-specific settings
- Producing final MonitoringGroup objects with fully processed accounts

Usage:
```typescript
import { ConfigProcessor } from './config-processor';

const configFiles = ['config1.yaml', 'config2.yaml'];
const monitoringGroups = ConfigProcessor.processConfigs(configFiles);
```

### 2. Config Validator (`config-validator.ts`)

The Config Validator ensures that the raw configuration data adheres to the expected structure and contains valid values.

Key features:
- Validating the overall structure of the configuration
- Checking for required fields and correct data types
- Ensuring that monitor-specific configurations are valid
- Verifying that account addresses are in the correct format

Usage:
```typescript
import { validateConfig } from './config-validator';

try {
  validateConfig(rawConfig);
  console.log('Configuration is valid');
} catch (error) {
  console.error('Configuration validation failed:', error.message);
}
```

### 3. Address Transformer (`address-transformer.ts`)

The Address Transformer handles the conversion and normalization of blockchain addresses across different formats and chains.

Key features:
- Accepting either hex or SS58 address formats as input and ensuring both are in the output
- Deriving a default name from the address if not provided
- Recalculating the SS58 address for the specified chain, regardless of the input address's original chain

Usage:
```typescript
import { AddressTransformer } from './address-transformer';
import { Chain } from '../constants';

const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const result = AddressTransformer.transform(address, undefined, Chain.Polkadot);
```

### 4. Account Settings Builder (`account-settings-builder.ts`)

The Account Settings Builder is responsible for constructing the final account settings object used in the chain watcher.

Key responsibilities:
- Combining account-specific settings with group-level monitor configurations
- Applying default values for missing monitor settings
- Constructing a final account settings object which includes each monitor type

Usage:
```typescript
import { AccountSettingsBuilder } from './account-settings-builder';

const monitorConfigs = [/* ... */];
const accountSettings = {/* ... */};
const result = AccountSettingsBuilder.buildSettings(monitorConfigs, accountSettings);
```

## Workflow

1. The Config Processor loads and validates the configuration files using the Config Validator.
2. Raw configurations are transformed into structured monitoring groups.
3. For each account in the groups:
   - The Address Transformer normalizes the account address.
   - The Account Settings Builder constructs the final settings object.
4. The resulting MonitoringGroup objects are used throughout the Chain Watcher application.
