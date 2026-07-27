# Monitors & Handlers Reference

Handlers are the unit of configuration: a monitor groups related handlers, and you enable the ones you want explicitly. See the [Configuration Guide](CONFIG_GUIDE.md) for the YAML format.

**Handler type** — the kind of chain data processed:

- `*Event` — a chain event
- `*Call` — an extrinsic call, including nested ones (batch, proxy, multisig)
- `*State` — a storage check, run on every block

**Lifecycle** — independent from the type:

- *one-time* — recorded and resolved immediately
- *ongoing* — fires while the condition holds, resolves automatically when it clears

Note that a `*State` handler is not necessarily *ongoing*: some compare two blocks and report a one-time incident. Each table below marks the lifecycle per handler.

Chain support is per monitor. A handler enabled for a chain the monitor doesn't support is silently ignored.

## Staking Monitor

Chains: `AssetHubPolkadot`, `AssetHubKusama`, `AssetHubPaseo`

| Handler | Type | Lifecycle | Fires when |
| --- | --- | --- | --- |
| `OffenceReportedEvent` | Event `staking.OffenceReported` | one-time | an offence is reported for the validator |
| `CommissionChangedEvent` | Event `staking.ValidatorPrefsSet` | one-time | validator preferences (commission) are set |
| `UnbondedEvent` | Event `staking.Unbonded` | one-time | tokens are unbonded |
| `DestinationChangedCall` | Call `staking.setPayee`, `staking.bond` | one-time | the account submits a call that sets the reward destination |
| `DestinationChangedState` | State `staking.payee` | one-time | the reward destination differs from the previous block |
| `CommissionUnexpectedState` | State `staking.validators` | ongoing | commission is **above** `commission` |
| `SelfStakeUnexpectedState` | State `staking.bonded`, `staking.ledger` | ongoing | active self-stake is **below** `selfStake` |
| `DestinationUnexpectedState` | State `staking.payee` | ongoing | the reward destination is not `payee` |
| `ValidatorIntentionMissingState` | State `staking.bonded`, `staking.validators` | ongoing | the account is not bonded, or has no validator preferences |
| `ActiveSetPresenceState` | State `staking.activeEra`, `staking.erasStakersOverview` | ongoing | the account is not in the active set of the active era |

Config keys:

- `commission`: (number) expected commission percentage (0-100)
- `selfStake`: (string) expected self-stake as a decimal string, e.g. `"1000.5"`
- `payee`: (string) expected reward destination as reported on chain — `Staked`, `Stash`, `Controller`, `None`, or an SS58 address for `Account`
- `fromEra` / `untilEra`: (number, optional) era bounds, see below

### Era Bounds

All `*State` handlers of this monitor respect optional era bounds: `fromEra` (inclusive) and `untilEra` (exclusive). Outside that window the handler stays quiet, and any incident still open is resolved. This avoids false incidents when transitioning between validator cohorts. When both are set, `fromEra` must be lower than `untilEra`.

```yaml
groups:
  # Old cohort: monitored until era 1050
  - id: validators-cohort-1-example
    chains: [AssetHubPolkadot]
    accountSetNames: [old-validators]
    monitors:
      - name: Staking
        untilEra: 1050
        handlers: [ActiveSetPresenceState]

  # New cohort: monitored from era 1050 on
  - id: validators-cohort-2-example
    chains: [AssetHubPolkadot]
    accountSetNames: [new-validators]
    monitors:
      - name: Staking
        fromEra: 1050
        handlers: [ActiveSetPresenceState]
```

Era bounds can also be set per account in an account set, which is handy for mixed cohorts:

```yaml
accountSets:
  mixed-validators:
    - address: "5GrwvaEF..."
      untilEra: 1050
    - address: "5HGjWAeF..."
      fromEra: 1050
```

### Example

```yaml
monitors:
  - name: Staking
    commission: 10          # group-wide expectation
    handlers:
      - CommissionUnexpectedState
      - OffenceReportedEvent

accountSets:
  validators-set:
    - address: "..."
      commission: 5         # overrides the group value
      selfStake: "1000.5"
      payee: "Staked"
```

## Balances Monitor

Chains: `AssetHubPolkadot`, `AssetHubKusama`, `AssetHubPaseo`, `Frequency`

Balances are the **free** balance of the native token.

| Handler | Type | Lifecycle | Fires when |
| --- | --- | --- | --- |
| `BalanceDecreaseState` | State `system.account` | one-time | the balance is lower than in the previous block |
| `BalanceThresholdState` | State `system.account` | ongoing | the balance is below `threshold` |
| `TransferIngressEvent` | Event `balances.Transfer` | one-time | the account receives a transfer |
| `TransferEgressEvent` | Event `balances.Transfer` | one-time | the account sends a transfer |
| `TransferCall` | Call `balances.transferAllowDeath`, `balances.transferKeepAlive` | one-time | the account submits a transfer call (kept for testing nested calls) |

Config keys:

- `threshold`: (string) balance threshold as a decimal string, e.g. `"1000.0"`

### Example

```yaml
monitors:
  - name: Balances
    threshold: "1000.0"
    handlers:
      - BalanceThresholdState
      - TransferIngressEvent

accountSets:
  treasury-set:
    - address: "..."
      threshold: "500.0"    # overrides the group value
```

## Assets Monitor

Chains: `AssetHubPolkadot`, `AssetHubKusama`, `AssetHubPaseo` (`assets` pallet), `Centrifuge` (`ormlTokens` pallet)

Only known tokens can be monitored, and `tokens` / `tokenThresholds` are validated against this list: `USDC` and `USDT` on AssetHubPolkadot, `USDT` on AssetHubKusama, `localUSDC` on Centrifuge (none on AssetHubPaseo yet). The native token (DOT, KSM, …) is covered by the Balances monitor.

| Handler | Type | Lifecycle | Fires when |
| --- | --- | --- | --- |
| `AssetBalanceDecreaseState` | State `assets.account`, `ormlTokens.accounts` | one-time | an asset balance is lower than in the previous block |
| `AssetBalanceThresholdState` | State `assets.account`, `ormlTokens.accounts` | ongoing | an asset balance is below its threshold |
| `AssetTransferIngressEvent` | Event `assets.Transferred`, `ormlTokens.Transfer` | one-time | the account receives an asset transfer |
| `AssetTransferEgressEvent` | Event `assets.Transferred`, `ormlTokens.Transfer` | one-time | the account sends an asset transfer |

Config keys:

- `tokens`: (array) token names to watch — used by the decrease and transfer handlers
- `tokenThresholds`: (array) `[token, threshold]` pairs, threshold as a decimal string — used by `AssetBalanceThresholdState`

### Example

```yaml
monitors:
  - name: Assets
    tokens: [USDC, USDT]
    tokenThresholds: [[USDC, "100.0"], [USDT, "100.0"]]
    handlers:
      - AssetBalanceThresholdState
      - AssetTransferEgressEvent
```

## Identity Monitor

Chains: `PeoplePolkadot`, `PeopleKusama`, `PeoplePaseo`

Sub-identities are resolved through `identity.superOf`, so for a sub-account the parent's identity is checked.

| Handler | Type | Lifecycle | Fires when |
| --- | --- | --- | --- |
| `IdentityUnexpectedState` | State `identity.identityOf`, `identity.superOf` | ongoing | a configured field does not match the on-chain value |
| `IdentityChangedEvent` | Event `identity.IdentitySet`, `identity.IdentityCleared`, `identity.IdentityKilled` | one-time | the identity is set, cleared, or killed |
| `IdentityMissingState` | State `identity.identityOf`, `identity.superOf` | ongoing | the account (or its parent) has no identity |
| `IdentityFieldsMissingState` | State `identity.identityOf`, `identity.superOf` | ongoing | `email` or `matrix` is not set — the required set is fixed, not yet configurable |

Config keys — the expected value of any identity field, all optional: `display`, `legal`, `web`, `matrix`, `email`, `image`, `twitter`, `github`, `discord`. Only the fields you set are checked.

### Example

```yaml
monitors:
  - name: Identity
    handlers:
      - IdentityChangedEvent
      - IdentityMissingState

accountSets:
  validators-set:
    - address: "..."
      display: "Validator Name"
      email: "email@example.com"
      matrix: "@user:matrix.org"
```

## Governance Monitor

Chains: `AssetHubPolkadot`, `AssetHubKusama`, `AssetHubPaseo`

| Handler | Type | Lifecycle | Fires when |
| --- | --- | --- | --- |
| `ReferendaSubmittedEvent` | Event `referenda.Submitted` | one-time | any referendum is submitted — this handler is account-independent: it fires once per group that enables it, regardless of the group's accounts |
| `ConvictionVoteCall` | Call `convictionVoting.vote` | one-time | the account votes on a referendum |

### Example

```yaml
monitors:
  - name: Governance
    handlers:
      - ReferendaSubmittedEvent
      - ConvictionVoteCall
```

## XCM Monitor

Chains: `AssetHubPolkadot`, `AssetHubKusama`, `AssetHubPaseo`

| Handler | Type | Lifecycle | Fires when |
| --- | --- | --- | --- |
| `XcmTransferEgressEvent` | Event `polkadotXcm.Sent`, `xcmPallet.Sent` | one-time | the account sends a cross-chain transfer |

### Example

```yaml
monitors:
  - name: Xcm
    handlers:
      - XcmTransferEgressEvent
```

## Related Documentation

- [Configuration Guide](CONFIG_GUIDE.md) — the YAML configuration format
