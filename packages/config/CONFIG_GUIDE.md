# Configuration Guide

This guide explains how to configure the monitoring platform using YAML configuration files. It references the monitors and handlers described in the [Monitors & Handlers Reference](./MONITORS.md).

## Configuration Structure

A configuration file consists of two main sections:
- `defaults` - Default settings applied to all groups
- `groups` - List of monitoring groups with their specific settings

```yaml
defaults:
  # Default settings
groups:
  - name: group1
    # Group settings
```

## Required Configuration

Every configuration must have:
1. At least one group
2. Each group must have:
   - `chains` (directly or from defaults)
   - `monitors` (directly or from defaults)
   - `alerts` (directly or from defaults)
   - At least one account

## Default Settings

```yaml
defaults:
  chains:
    - Polkadot
    - Kusama
    
  alerts:
    messengerType: matrix
    targets: ['!roomid:matrix.org']
    acknowledgement: true
    repeatIntervalHours: 24
    
  monitors:
    - name: Staking
      commission: 10
      handlers:
        - CommissionChanged
        - SlashReported
```

## Group Configuration

Each group defines a set of accounts to monitor with specific settings:

```yaml
groups:
  - name: validators-group
    chains:
      - Kusama
    
    alerts:
      messengerType: matrix
      targets: ['!customroom:matrix.org']
    
    monitors:
      - name: Staking
        commission: 7
      - name: Balances
        threshold: "500.75"
      - name: Identity
    
    accounts:
      - address: "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F"
        name: "Validator1"
        commission: 3
        selfStake: "1000.5"
```

## Value Formats & Validation

### Addresses
- Can be either SS58 or hex format
- SS58: 47-48 characters starting with a number or letter
- Hex: 64 characters prefixed with "0x"
- Will be automatically converted to chain-specific SS58 format

### Balance Values
- Must be strings with optional decimal point (e.g., "100.5", "1000")
- Represent token units (DOT/KSM), not planks
- Will be automatically converted to chain-specific bigint values
- Examples: "0.1" DOT = 1000000000n planks (0.1 * 10^10)

### Comparison Values
- Valid values: "eq", "gt", "lt", "gte", "lte"
- Ex. defaults for Staking monitor:
  - `commissionComparison`: "lte" (less than or equal)
  - `selfStakeComparison`: "gte" (greater than or equal)

### Alert Targets
- Currently only supports Matrix rooms
- Must match format: `!roomid:server.name`
- At least one target required

## Configuration Processing

The platform processes configuration in the following order:

1. Load and Validate:
   - Validate file structure and required fields
   - Check format of addresses, decimals, and other values

2. Apply Defaults:
   - Group settings fallback to defaults if not specified
   - Default comparison types for monitors
   - Generate default names for accounts if not provided

3. Transform Values:
   - Convert addresses to chain-specific SS58 format
   - Convert decimal balances to chain-specific bigint values
   - Build monitor-specific settings objects for each account

4. Group Processing:
   - Create separate group for each chain in group's chains
   - Apply monitor settings hierarchy (account overrides group settings)
   - Preserve handler configurations from monitor level

## Handler Configuration

```yaml
# Handlers array is required and must contain at least one handler
handlers:
  - CommissionChanged
  - SlashReported
```

## Monitor Settings Hierarchy

The configuration system supports a hierarchical approach to settings:

1. **Default Level**: Settings defined in the `defaults.monitors` section
2. **Group Level**: Settings defined in a group's `monitors` section override defaults
3. **Account Level**: Settings defined directly on an account override both group and defaults

Example:

```yaml
defaults:
  monitors:
    - name: Staking
      commission: 10  # Default commission for all validators

groups:
  - name: validators-group
    monitors:
      - name: Staking
        commission: 7  # Override for this group
    
    accounts:
      - address: "..."
        name: "Validator1"
        commission: 3  # Override for this specific validator
```

## Configuration Example

```yaml
defaults:
  chains:
    - Polkadot
  alerts:
    messengerType: matrix
    targets: ['!roomid:matrix.org']
    acknowledgement: true

groups:
  - name: validators
    monitors:
      - name: Staking
        commission: 5
        handlers:
          - CommissionChanged
          - SlashReported
      - name: Balances
        threshold: "1000.0"
        handlers:
          - BalanceThreshold
          - TransferIngress
    accounts:
      - address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
        name: "Alice Validator"
        commission: 3
        selfStake: "5000.0"
```

For a complete reference of all available monitors and handlers, see the [Monitors & Handlers Reference](./MONITORS.md).
