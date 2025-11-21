# Configuration Guide

This guide explains how to configure the monitoring polkadot using YAML configuration files. It references the monitors and handlers described in the [Monitors & Handlers Reference](./MONITORS.md).

## Configuration Structure

A configuration file consists of three main sections:
- `accountSets` - Named account sets that can be referenced by groups
- `defaults` - Default settings applied to all groups
- `groups` - List of monitoring groups with their specific settings

```yaml
defaults:
  # Default settings

accountSets:
  account-set-name:
    - address: "..."
    # ... more accounts

groups:
  - name: group1
    accountSet: account-set-name
    # Group settings
```

## Required Configuration

Every configuration must have:
1. At least one group
2. At least one account set in the `accountSets` section
3. Each group must have:
   - `chains` (directly or from defaults)
   - `monitors` (directly or from defaults)
   - `notifications` (directly or from defaults)
   - `accountSet` field referencing an account set name

## Default Settings

```yaml
defaults:
  chains:
    - Polkadot
    - Kusama
    
  notifications:
    messengerType: Matrix
    channels: ['!roomid:matrix.org']
    needsAck: true
    repeatFiringMs: 3600
    
  monitors:
    - name: Staking
      commission: 10
      handlers:
        - CommissionChangedEvent
        - SlashReportedEvent
```

## Account Sets

Account sets allow you to define groups of accounts once and reference them across multiple monitoring groups:

```yaml
accountSets:
  validators-set:
    - address: "HNZata7iMYWmk5RvZRTiAsSDhV8366zq2YGb3tLH5Upf74F"
      name: "Validator1"
      commission: 3
      selfStake: "1000.5"
    - address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
      name: "Validator2"
```

## Group Configuration

Each group references an account set and defines monitoring settings:

```yaml
groups:
  - name: validators-group
    chains:
      - Kusama
    
    notifications:
      messengerType: Matrix
      channels: ['!customroom:matrix.org']
    
    monitors:
      - name: Staking
        commission: 7
      - name: Balances
        threshold: "500.75"
      - name: Identity
    
    accountSet: validators-set
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

### Notification Channels
- Currently only supports Matrix rooms
- Must match format: `!roomid:server.name`
- At least one channel required

### Incident Escalation

You can configure escalation channels and a timeout to automatically notify additional recipients if an incident requiring acknowledgment is not acknowledged in time.

```yaml
notifications:
  messengerType: Matrix
  channels: ['!roomid:matrix.org']
  escalationChannels: ['!escalationroom:matrix.org']  # optional
  escalationTimeoutMs: 3600000  # optional value in milliseconds, defaults to 1 hour
  needsAck: true
```
When `needsAck` is true, escalation will trigger after `escalationTimeoutMs` unless the incident is acknowledged.

## Configuration Processing

The platform processes configuration in the following order:

1. Load and Validate:
   - Validate file structure and required fields
   - Check format of addresses, decimals, and other values

2. Transform Values:
   - Generate default names for accounts if not provided
   - Convert addresses to chain-specific SS58 format
   - Convert decimal balances to chain-specific bigint values
   - Build monitor-specific settings objects for each account

3. Group Processing:
   - Create separate group for each chain in group's chains
   - Apply monitor settings hierarchy (account overrides group settings)
   - Preserve handler configurations from monitor level

## Handler Configuration

```yaml
# Handlers array is required and must contain at least one handler
handlers:
  - CommissionChangedEvent
  - SlashReportedEvent
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

## Annotations

The configuration supports an `annotations` field at the group, monitor, and account levels. This field allows external tools to store arbitrary metadata in the monitoring configuration.

```yaml
groups:
  - name: validators
    annotations:
      enablePayout: true
    monitors:
      - name: Staking
        annotations:
          tag: group-N
    accounts:
      - address: "..."
        annotations:
          tag: group-R  # Overrides monitor's tag
```

The `annotations` field bypasses validation and follows the same override rules as other settings.

## Configuration Example

```yaml
accountSets:
  validators-set:
    - address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
      name: "Alice Validator"
      commission: 3
      selfStake: "5000.0"

defaults:
  chains:
    - Polkadot
  notifications:
    messengerType: Matrix
    channels: ['!roomid:matrix.org']
    needsAck: true

groups:
  - name: validators-staking-with-ack
    monitors:
      - name: Staking
        commission: 5
        handlers:
          - CommissionChangedEvent
          - SlashReportedEvent
      - name: Balances
        threshold: "1000.0"
        handlers:
          - BalanceThresholdState
          - TransferIngressEvent
    accountSet: validators-set

  - name: validators-balances-no-ack
    monitors:
      - name: Balances
        handlers:
          - TransferEgressEvent
    notifications:
      messengerType: Matrix
      channels: ['!roomid:matrix.org']
      needsAck: false
      repeatFiringMs: 604800
    accountSet: validators-set
```

For a complete reference of all available monitors and handlers, see the [Monitors & Handlers Reference](./MONITORS.md).
