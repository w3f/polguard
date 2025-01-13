# Monitoring Configuration

This package contains the configuration processing and validation logic for the Chain Watcher application.

## Main Component

### Config Processor (`config-processor.ts`)

Processes configuration files and transforms them into structured monitoring groups.

Key responsibilities:
* Loading and validating YAML configuration files:
  * Ensures required fields are present
  * Validates field formats and values
  * Checks cross-field dependencies
* Applying defaults:
  * Uses defaults.chains if group.chains not provided
  * Uses defaults.monitors if group.monitors not provided
  * Uses defaults.alerts if group.alerts not provided
  * Applies default comparison types for monitors
* Building final monitoring structure:
  * Creates separate group for each chain configuration
  * Transforms addresses to chain-specific SS58 format
  * Merges monitor-level settings and account-level settings with priority to accounts
  * Converts decimal balance strings to chain-specific BigInt values

Example output:
```typescript
[
  {
    name: "validators group",
    chain: Chain.Polkadot,
    monitors: [
      {
        name: MonitorType.Staking,
        settings: { commission: 10, handlers: { include: ["CommissionChanged"] } }
      }
    ],
    accounts: [
      {
        name: "5Grw...utQY",
        hex: "0xd43593c715fdd31c61141abd04a99fd6822c8558854ccde39a5684e7a56da27d",
        ss58: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
        Staking: {
          commission: 5,
          commissionComparison: ComparisonType.LessThanOrEqual,
          selfStakeComparison: ComparisonType.GreaterThanOrEqual,
          selfStake: 10005000000000n
        }
      }
    ],
    alerts: {
      messengerType: "matrix",
      targets: ["!room:matrix.org"]
    }
  }
]
```

## Supporting Components

### Account Settings Builder (`account-settings-builder.ts`)
Builds account monitor settings by combining monitor and account-level configurations, applying defaults, and converting decimal balances to BigInt values.

### Config Validator (`config-validator.ts`)
Performs validation of raw configuration data without modifying it. Ensures proper structure, required fields, and valid formats.

### Address Transformer (`address-transformer.ts`)
Handles blockchain address transformations between hex and SS58 formats, ensuring correct chain-specific encoding.