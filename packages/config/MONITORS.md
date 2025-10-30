# Monitors & Handlers Reference

The platform includes several specialized monitors, each responsible for tracking different aspects of blockchain networks:

- **Staking Monitor**: Tracks validator activities, commission rates, staking parameters
- **Balances Monitor**: Monitors account balances and transfers
- **Assets Monitor**: Monitors asset/token balances and transfers
- **Identity Monitor**: Tracks on-chain identity information
- **Governance Monitor**: Monitors governance activities like referenda and voting
- **XCM Monitor**: Tracks cross-chain asset transfers

Each monitor contains multiple handlers that process specific events, calls, or state changes.

## Staking Monitor

Monitors validator staking activities.

### Handlers

#### SlashReportedEvent
- **Type**: Event (`staking.SlashReported`)
- **Chains**: Polkadot, Kusama
- **Description**: Detects when a validator is slashed

#### CommissionChangedEvent
- **Type**: Event (`staking.ValidatorPrefsSet`)
- **Chains**: Polkadot, Kusama
- **Description**: Detects changes to validator commission

#### UnbondedEvent
- **Type**: Event (`staking.Unbonded`)
- **Chains**: Polkadot, Kusama
- **Description**: Detects when tokens are unbonded

#### DestinationChangedCall
- **Type**: Call (`staking.setPayee`, `staking.bond`)
- **Chains**: Polkadot, Kusama
- **Description**: Detects changes to reward destination

#### CommissionUnexpectedState
- **Type**: State (`staking.validators`)
- **Chains**: Polkadot, Kusama
- **Description**: Alerts when commission doesn't match expected value
- **Config Keys**:
  - `commission`: (number) Expected commission percentage (0-100)
  - `fromEra`: (number, optional) Start monitoring from this era (inclusive)
  - `untilEra`: (number, optional) Stop monitoring before this era (exclusive)

#### SelfStakeUnexpectedState
- **Type**: State (`staking.bonded`, `staking.ledger`)
- **Chains**: Polkadot, Kusama
- **Description**: Alerts when self-stake doesn't match expected value
- **Config Keys**:
  - `selfStake`: (string) Expected self-stake amount as a decimal string (e.g., "1000.5")
  - `fromEra`: (number, optional) Start monitoring from this era (inclusive)
  - `untilEra`: (number, optional) Stop monitoring before this era (exclusive)

#### ValidatorIntentionMissingState
- **Type**: State (`staking.bonded`, `staking.validators`)
- **Chains**: Polkadot, Kusama
- **Description**: Alerts when validator intention is missing
- **Config Keys**:
  - `fromEra`: (number, optional) Start monitoring from this era (inclusive)
  - `untilEra`: (number, optional) Stop monitoring before this era (exclusive)

#### DestinationUnexpectedState
- **Type**: State (`staking.payee`)
- **Chains**: Polkadot, Kusama
- **Description**: Alerts when reward destination doesn't match expected value
- **Config Keys**:
  - `payee`: (string) Expected reward destination - one of: "Staked", "Stash", "Controller"
  - `fromEra`: (number, optional) Start monitoring from this era (inclusive)
  - `untilEra`: (number, optional) Stop monitoring before this era (exclusive)

#### DestinationChangedState
- **Type**: State (`staking.payee`)
- **Chains**: Polkadot, Kusama
- **Description**: Detects changes to reward destination between blocks

#### ActiveSetPresenceState
- **Type**: State (`session.validators`)
- **Chains**: Polkadot, Kusama
- **Description**: Monitors validator presence in the active set
- **Config Keys**:
  - `fromEra`: (number, optional) Start monitoring from this era (inclusive)
  - `untilEra`: (number, optional) Stop monitoring before this era (exclusive)

### Era Bounds

Era bounds allow you to limit monitoring to specific era ranges. This is particularly useful when transitioning between validator cohorts to avoid false incidents.

**Example - Cohort Transition:**

```yaml
accountSets:
  old-validators:
    - address: "5GrwvaEF..."
      name: "Validator Old"
  
  new-validators:
    - address: "5HGjWAeF..."
      name: "Validator New"

groups:
  # Monitor old cohort until era 1050 (exclusive)
  - name: validators-cohort-1
    chains: [Polkadot]
    accountSet: old-validators
    monitors:
      - name: Staking
        untilEra: 1050
        handlers:
          - ActiveSetPresenceState
  
  # Monitor new cohort from era 1050 onwards
  - name: validators-cohort-2
    chains: [Polkadot]
    accountSet: new-validators
    monitors:
      - name: Staking
        fromEra: 1050
        handlers:
          - ActiveSetPresenceState
```

Alternatively, set era bounds at the account level:

```yaml
accountSets:
  mixed-validators:
    - address: "5GrwvaEF..."
      name: "Validator Old"
      untilEra: 1050
    - address: "5HGjWAeF..."
      name: "Validator New"
      fromEra: 1050
```

### Example Configuration

```yaml
monitors:
  - name: Staking
    commission: 10  # Default commission percentage
    handlers:
      - CommissionChangedEvent
      - SlashReportedEvent

accounts:
  - address: "..."
    commission: 5  # Expected commission percentage
    selfStake: "1000.5"  # Expected self-stake amount
    payee: "Staked"  # Expected reward destination
```

## Balances Monitor

Monitors account balances and transfers.

### Handlers

#### BalanceDecreaseState
- **Type**: State (`system.account`)
- **Chains**: Polkadot, AssetHub Kusama, Frequency
- **Description**: Detects any balance decreases between blocks

#### BalanceThresholdState
- **Type**: State (`system.account`)
- **Chains**: Polkadot, AssetHub Kusama, Frequency
- **Description**: Alerts when balance falls below a threshold
- **Config Keys**:
  - `threshold`: (string) Balance threshold value as a decimal string (e.g., "1000.0")

#### TransferIngressEvent
- **Type**: Event (`balances.Transfer`)
- **Chains**: Polkadot, AssetHub Kusama, Frequency
- **Description**: Detects incoming transfers

#### TransferEgressEvent
- **Type**: Event (`balances.Transfer`)
- **Chains**: Polkadot, AssetHub Kusama, Frequency
- **Description**: Detects outgoing transfers

#### TransferCall
- **Type**: Call (`balances.transfer`)
- **Chains**: Polkadot, AssetHub Kusama, Frequency
- **Description**: Detects transfer calls (for testing purposes)

### Example Configuration

```yaml
monitors:
  - name: Balances
    threshold: "1000.0"  # Default balance threshold
    handlers:
      - BalanceThresholdState
      - TransferIngressEvent

accounts:
  - address: "..."
    threshold: "500.0"  # Account-specific threshold
```

## Assets Monitor

Monitors asset/token balances and transfers.

### Handlers

#### AssetBalanceDecreaseState
- **Type**: State (`assets.account`, `ormlTokens.accounts`)
- **Chains**: AssetHubPolkadot, AssetHubKusama, Centrifuge
- **Description**: Detects any asset balance decreases between blocks
- **Config Keys**:
  - `tokens`: (array) List of token names to monitor

#### AssetBalanceThresholdState
- **Type**: State (`assets.account`, `ormlTokens.accounts`)
- **Chains**: AssetHubPolkadot, AssetHubKusama, Centrifuge
- **Description**: Alerts when asset balance falls below a threshold
- **Config Keys**:
  - `tokenThresholds`: (array) Array of [token, threshold] pairs where threshold is a decimal string

#### AssetTransferIngressEvent
- **Type**: Event (`assets.Transferred`, `ormlTokens.Transfer`)
- **Chains**: AssetHubPolkadot, AssetHubKusama, Centrifuge
- **Description**: Detects incoming asset transfers
- **Config Keys**:
  - `tokens`: (array) List of token names to monitor

#### AssetTransferEgressEvent
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
      - AssetBalanceThresholdState
      - AssetTransferIngressEvent
      - AssetTransferEgressEvent

accounts:
  - address: "..."
    tokens: ["DOT", "KSM"]
    tokenThresholds: [["DOT", "100.0"], ["KSM", "10.0"]]
```

## Identity Monitor

Monitors on-chain identity information.

### Handlers

#### IdentityUnexpectedState
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

#### IdentityChangedEvent
- **Type**: Event (`identity.IdentitySet`, `identity.IdentityCleared`, `identity.IdentityKilled`)
- **Chains**: PeoplePolkadot, PeopleKusama
- **Description**: Detects changes to identity information

#### IdentityMissingState
- **Type**: State (`identity.identityOf`, `identity.superOf`)
- **Chains**: PeoplePolkadot, PeopleKusama
- **Description**: Alerts when identity is missing

#### IdentityFieldsMissingState
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

#### ReferendaSubmittedEvent
- **Type**: Event (`referenda.Submitted`)
- **Chains**: Polkadot, Kusama
- **Description**: Detects when new referenda are submitted

#### ConvictionVoteCall
- **Type**: Call (`convictionVoting.vote`)
- **Chains**: Polkadot, Kusama
- **Description**: Detects conviction voting activities

### Example Configuration

```yaml
monitors:
  - name: Governance
    handlers:
      - ReferendaSubmittedEvent
      - ConvictionVoteCall
```

## XCM Monitor

Monitors cross-chain asset transfers.

### Handlers

#### XcmTransferEgressEvent
- **Type**: Event (`polkadotXcm.Sent`, `xcmPallet.Sent`)
- **Chains**: Polkadot, Kusama, AssetHubPolkadot, AssetHubKusama
- **Description**: Detects outgoing cross-chain asset transfers

### Example Configuration

```yaml
monitors:
  - name: Xcm
    handlers:
      - XcmTransferEgressEvent
```

## Handler Types

Handlers are categorized by the type of blockchain data they process:

- **Event Handlers**: Process specific blockchain events
- **Call Handlers**: Process extrinsic calls
- **State Handlers**: Execute periodically on every block to check blockchain state

## Handler Configuration

You should configure which handlers are active for each monitor:

```yaml
handlers:  # Required: explicitly list desired handlers
  - CommissionChangedEvent
  - SlashReportedEvent
```

## Related Documentation

- [Configuration Guide](CONFIG_GUIDE.md) - Detailed guide to the YAML configuration format
