# Monitors & Handlers Reference

This document provides a comprehensive reference of all monitors and handlers available in the Monitoring Platform.

## Overview

The platform includes several specialized monitors, each responsible for tracking different aspects of blockchain networks:

- **Staking Monitor**: Tracks validator activities, commission rates, staking parameters
- **Balances Monitor**: Monitors account balances and transfers
- **Assets Monitor**: Monitors asset/token balances and transfers
- **Identity Monitor**: Tracks on-chain identity information
- **Governance Monitor**: Monitors governance activities like referenda and voting
- **XCM Monitor**: Tracks cross-chain asset transfers
- **Telemetry Monitor**: Monitors node telemetry data (hardware, software, location)

Each monitor contains multiple handlers that process specific events, calls, or state changes.

## Staking Monitor

Monitors validator staking activities.

### Handlers

#### SlashReported
- **Type**: Event (`staking.SlashReported`)
- **Chains**: Polkadot, Kusama
- **Description**: Detects when a validator is slashed

#### CommissionChanged
- **Type**: Event (`staking.ValidatorPrefsSet`)
- **Chains**: Polkadot, Kusama
- **Description**: Detects changes to validator commission

#### DestinationChanged
- **Type**: Call (`staking.setPayee`, `staking.bond`)
- **Chains**: Polkadot, Kusama
- **Description**: Detects changes to reward destination

#### CommissionUnexpected
- **Type**: State (`staking.validators`)
- **Chains**: Polkadot, Kusama
- **Description**: Alerts when commission doesn't match expected value
- **Config Keys**:
  - `commission`: (number) Expected commission percentage (0-100)

#### SelfStakeUnexpected
- **Type**: State (`staking.bonded`, `staking.ledger`)
- **Chains**: Polkadot, Kusama
- **Description**: Alerts when self-stake doesn't match expected value
- **Config Keys**:
  - `selfStake`: (string) Expected self-stake amount as a decimal string (e.g., "1000.5")

#### ValidatorIntentionMissing
- **Type**: State (`staking.bonded`, `staking.validators`)
- **Chains**: Polkadot, Kusama
- **Description**: Alerts when validator intention is missing

#### DestinationUnexpected
- **Type**: State (`staking.payee`)
- **Chains**: Polkadot, Kusama
- **Description**: Alerts when reward destination doesn't match expected value
- **Config Keys**:
  - `payee`: (string) Expected reward destination - one of: "Staked", "Stash", "Controller"

#### ActiveSetPresence
- **Type**: State (`session.validators`)
- **Chains**: Polkadot, Kusama
- **Description**: Monitors validator presence in the active set

### Example Configuration

```yaml
monitors:
  - name: Staking
    commission: 10  # Default commission percentage
    handlers:
      - CommissionChanged
      - SlashReported

accounts:
  - address: "..."
    commission: 5  # Expected commission percentage
    selfStake: "1000.5"  # Expected self-stake amount
    payee: "Staked"  # Expected reward destination
```

## Balances Monitor

Monitors account balances and transfers.

### Handlers

#### BalanceDecrease
- **Type**: State (`system.account`)
- **Chains**: Polkadot, Kusama
- **Description**: Detects any balance decreases between blocks

#### BalanceThreshold
- **Type**: State (`system.account`)
- **Chains**: Polkadot, Kusama
- **Description**: Alerts when balance falls below a threshold
- **Config Keys**:
  - `threshold`: (string) Balance threshold value as a decimal string (e.g., "1000.0")

#### TransferIngress
- **Type**: Event (`balances.Transfer`)
- **Chains**: Polkadot, Kusama
- **Description**: Detects incoming transfers

#### TransferEgress
- **Type**: Event (`balances.Transfer`)
- **Chains**: Polkadot, Kusama
- **Description**: Detects outgoing transfers

### Example Configuration

```yaml
monitors:
  - name: Balances
    threshold: "1000.0"  # Default balance threshold
    handlers:
      - BalanceThreshold
      - TransferIngress

accounts:
  - address: "..."
    threshold: "500.0"  # Account-specific threshold
```

## Assets Monitor

Monitors asset/token balances and transfers.

### Handlers

#### AssetBalanceDecrease
- **Type**: State (`assets.account`, `ormlTokens.accounts`)
- **Chains**: AssetHubPolkadot, AssetHubKusama, Centrifuge
- **Description**: Detects any asset balance decreases between blocks
- **Config Keys**:
  - `tokens`: (array) List of token names to monitor

#### AssetBalanceThreshold
- **Type**: State (`assets.account`, `ormlTokens.accounts`)
- **Chains**: AssetHubPolkadot, AssetHubKusama, Centrifuge
- **Description**: Alerts when asset balance falls below a threshold
- **Config Keys**:
  - `tokenThresholds`: (array) Array of [token, threshold] pairs where threshold is a decimal string

#### AssetTransferIngress
- **Type**: Event (`assets.Transferred`, `ormlTokens.Transfer`)
- **Chains**: AssetHubPolkadot, AssetHubKusama, Centrifuge
- **Description**: Detects incoming asset transfers
- **Config Keys**:
  - `tokens`: (array) List of token names to monitor

#### AssetTransferEgress
- **Type**: Event (`assets.Transferred`, `ormlTokens.Transfer`)
- **Chains**: AssetHubPolkadot, AssetHubKusama, Centrifuge
- **Description**: Detects outgoing asset transfers
- **Config Keys**:
  - `tokens`: (array) List of token names to monitor

### Example Configuration

```yaml
monitors:
  - name: Assets
    handlers:
      - AssetBalanceThreshold
      - AssetTransferIngress
      - AssetTransferEgress

accounts:
  - address: "..."
    tokens: ["DOT", "KSM"]
    tokenThresholds: [["DOT", "100.0"], ["KSM", "10.0"]]
```

## Identity Monitor

Monitors on-chain identity information.

### Handlers

#### IdentityUnexpected
- **Type**: State (`identity.identityOf`, `identity.superOf`)
- **Chains**: PeoplePolkadot, PeopleKusama
- **Description**: Alerts when identity doesn't match expected values
- **Config Keys**:
  - `display`: (string) Expected display name
  - `legal`: (string) Expected legal name
  - `web`: (string) Expected website URL
  - `matrix`: (string) Expected Matrix ID (e.g., "@user:matrix.org")
  - `email`: (string) Expected email address
  - `image`: (string) Expected image hash
  - `twitter`: (string) Expected Twitter handle
  - `github`: (string) Expected GitHub username
  - `discord`: (string) Expected Discord username

#### IdentityChanged
- **Type**: Event (`identity.IdentitySet`, `identity.IdentityCleared`, `identity.IdentityKilled`)
- **Chains**: PeoplePolkadot, PeopleKusama
- **Description**: Detects changes to identity information

#### IdentityMissing
- **Type**: State (`identity.identityOf`, `identity.superOf`)
- **Chains**: PeoplePolkadot, PeopleKusama
- **Description**: Alerts when identity is missing

#### IdentityFieldsMissing
- **Type**: State (`identity.identityOf`, `identity.superOf`)
- **Chains**: PeoplePolkadot, PeopleKusama
- **Description**: Alerts when specific identity fields are missing

### Example Configuration

```yaml
monitors:
  - name: Identity
    handlers:
      - IdentityChanged
      - IdentityMissing

accounts:
  - address: "..."
    display: "Validator Name"  # Expected display name
    email: "email@example.com"  # Expected email
    matrix: "@user:matrix.org"  # Expected Matrix ID
```

## Governance Monitor

Monitors governance activities.

### Handlers

#### ReferendaSubmitted
- **Type**: Event (`referenda.Submitted`)
- **Chains**: Polkadot, Kusama
- **Description**: Detects when new referenda are submitted

#### ConvictionVoted
- **Type**: Event (`convictionVoting.Voted`)
- **Chains**: Polkadot, Kusama
- **Description**: Detects conviction voting activities

### Example Configuration

```yaml
monitors:
  - name: Governance
    handlers:
      - ReferendaSubmitted
      - ConvictionVoted
```

## XCM Monitor

Monitors cross-chain asset transfers.

### Handlers

#### XcmTransferEgress
- **Type**: Event (`polkadotXcm.Sent`, `xcmPallet.Sent`)
- **Chains**: Polkadot, Kusama, AssetHubPolkadot, AssetHubKusama
- **Description**: Detects outgoing cross-chain asset transfers

### Example Configuration

```yaml
monitors:
  - name: Xcm
    handlers:
      - XcmTransferEgress
```

## Telemetry Monitor

Monitors node telemetry data.

### Handlers

#### LocationUnexpected
- **Type**: Telemetry
- **Chains**: Polkadot, Kusama
- **Description**: Alerts when node location doesn't match expectations
- **Config Keys**:
  - `sanctionedCountries`: (string[]) List of countries where nodes should not be located
  - `sanctionedRegions`: (string[]) List of regions where nodes should not be located

#### ProviderUnexpected
- **Type**: Telemetry
- **Chains**: Polkadot, Kusama
- **Description**: Alerts when node provider doesn't match expectations
- **Config Keys**:
  - `provider`: (string) Expected cloud/hosting provider name

#### VersionOutdated
- **Type**: Telemetry
- **Chains**: Polkadot, Kusama
- **Description**: Alerts when node software version is outdated
- **Config Keys**:
  - `clientVersion`: (object) Object mapping client implementations to minimum versions
    - `Polkadot`: (string) Minimum version for Parity Polkadot client (semver format)
    - `KagomeNode`: (string) Minimum version for Kagome Node client (semver format)

#### HardwareUnexpected
- **Type**: Telemetry
- **Chains**: Polkadot, Kusama
- **Description**: Alerts when node hardware doesn't meet requirements
- **Config Keys**:
  - `cpu`: (string) Expected CPU model
  - `minMemoryGB`: (number) Minimum memory in GB
  - `minCores`: (number) Minimum number of CPU cores

#### TelemetryMissing
- **Type**: Telemetry
- **Chains**: Polkadot, Kusama
- **Description**: Alerts when telemetry data is missing

#### IpSpoofing
- **Type**: Telemetry
- **Chains**: Polkadot, Kusama
- **Description**: Detects potential IP spoofing

### Example Configuration

```yaml
monitors:
  - name: Telemetry
    handlers:
      - VersionOutdated
      - TelemetryMissing
    clientVersion:
      Polkadot: "v1.0.0"
    provider: "AWS"
    minMemoryGB: 32
    minCores: 4
    sanctionedCountries: ["Country1"]
```

## Handler Types

Handlers are categorized by the type of blockchain data they process:

- **Event Handlers**: Process specific blockchain events
- **Call Handlers**: Process extrinsic calls
- **State Handlers**: Execute periodically on every block to check blockchain state
- **Telemetry Handlers**: Process node telemetry data

## Handler Configuration

You should configure which handlers are active for each monitor:

```yaml
handlers:  # Required: explicitly list desired handlers
  - CommissionChanged
  - SlashReported
```

## Related Documentation

- [Configuration Guide](CONFIG_GUIDE.md) - Detailed guide to the YAML configuration format
