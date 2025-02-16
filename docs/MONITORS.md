# Monitors & Handlers Reference

This document describes all available monitors and their handlers in the monitoring platform. Each monitor is responsible for observing specific aspects of the blockchain and can be configured to trigger alerts based on different conditions.

## Overview

The platform currently supports five types of monitors:
- Balances Monitor - tracks account balance changes and transfers
- Identity Monitor - verifies on-chain identity information
- Staking Monitor - monitors validator-specific parameters and status
- Telemetry Monitor - verifies node telemetry data and requirements
- Governance Monitor - (coming soon) will track governance participation

## Balances Monitor

Tracks account balance changes and transfer operations.

### Block Handlers

#### BalanceChange
Monitors balance changes between blocks.
- **Settings**:
  - `changeComparison`: Comparison type to determine when to trigger (eq, gt, lt, gte, lte)

#### BalanceThreshold
Checks if account balance falls below specified threshold.
- **Settings**:
  - `threshold`: Minimum balance amount (decimal string)

### Event Handlers

#### TransferIngress
Triggers when account receives a transfer.
- No specific settings required

#### TransferEgress
Triggers when account sends a transfer.
- No specific settings required

## Identity Monitor

Verifies on-chain identity information matches expected values.

### Block Handlers

#### IdentityUnexpected
Checks if identity fields match expected values.
- **Settings**: Any of the following identity fields:
  - `display`: Display name
  - `legal`: Legal name
  - `web`: Website URL
  - `matrix`: Matrix handle
  - `email`: Email address
  - `image`: Image URL
  - `twitter`: Twitter handle
  - `github`: GitHub handle
  - `discord`: Discord handle

### Event Handlers

#### IdentityChanged
Triggers when any identity field is modified.
- No specific settings required

## Staking Monitor

Monitors validator-specific parameters and status.

### Block Handlers

#### CommissionUnexpected
Verifies validator commission matches expected value.
- **Settings**:
  - `commission`: Expected commission percentage (required)
  - `commissionComparison`: Comparison type (eq, gt, lt, gte, lte). Default: "lte"

#### SelfStakeUnexpected
Monitors validator's self-stake amount.
- **Settings**:
  - `selfStake`: Expected stake amount
  - `selfStakeComparison`: Comparison type (eq, gt, lt, gte, lte). Default: "gte"

#### ValidatorIntentionMissing
Checks if account is properly set up as validator.
- No specific settings required

#### ActiveSetPresence
Monitors validator's presence in the active set.
- No specific settings required

#### DestinationUnexpected
Verifies reward destination matches expected value.
- **Settings**:
  - `payee`: Expected reward destination

### Event Handlers

#### SlashReported
Triggers when validator is slashed.
- No specific settings required

#### CommissionChanged
Triggers when validator changes commission.
- No specific settings required

### Call Handlers

#### DestinationChanged
Triggers when validator changes reward destination.
- No specific settings required

## Telemetry Monitor

Monitors node telemetry data and verifies hardware/software requirements.

### Block Handlers

#### HardwareUnexpected
Verifies node hardware meets requirements.
- **Settings**:
  - `cpu`: Expected CPU model
  - `minMemoryGB`: Minimum required memory in GB
  - `minCores`: Minimum required CPU cores

#### LocationUnexpected
Checks if node is running in allowed regions.
- **Settings**:
  - `sanctionedCountries`: List of disallowed countries
  - `sanctionedRegions`: List of disallowed regions

#### ProviderUnexpected
Verifies node is running on expected cloud provider.
- **Settings**:
  - `provider`: Expected cloud provider name

#### VersionOutdated
Checks if node is running expected client version.
- **Settings**:
  - `clientVersion`: Map of client implementations to expected versions
  Example:
  ```yaml
  clientVersion:
    "Parity Polkadot": "v1.0.0"
    "Kagome Node": "v1.0.0"
  ```

#### IpSpoofing
Detects potential IP address spoofing.
- No specific settings required

#### TelemetryMissing
Alerts when node telemetry data is unavailable.
- No specific settings required
