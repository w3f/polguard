# Configuration Guide

This guide explains how to configure the monitoring polkadot using YAML configuration files. It references the monitors and handlers described in the [Monitors & Handlers Reference](./MONITORS.md).

## Incidents: one concept, two properties

Everything PolGuard reports is an **incident**. Each incident has two independent properties you control through configuration:

- **Lifecycle** — determined by the **handler** you choose:
  - *one-time* — a single occurrence, recorded and immediately resolved (e.g. `TransferEgressEvent`)
  - *ongoing* — a condition that fires and later resolves (e.g. `BalanceThresholdState`)

  Each handler's lifecycle is documented in the [Monitors & Handlers Reference](./MONITORS.md).
- **Response** — determined by **`needsAck`** in the group's `notifications`:
  - *actionable* (`needsAck: true`) — a human must acknowledge it; if escalation is configured, it escalates when left unacknowledged
  - *informational* (`needsAck: false`, the default) — surfaced for awareness, no reaction expected

The two are independent: a one-time incident can be actionable (e.g. a watched-account transfer someone must confirm), and an ongoing one can be informational.

## Configuration Structure

A configuration file consists of three sections:

- `accountSets` — named sets of accounts, referenced by groups (required)
- `groups` — what to monitor, and how to report it (required)
- `defaults` — settings applied to groups that don't define their own (optional)

```yaml
defaults:
  # Fallbacks for chains, monitors, notifications, operations

accountSets:
  account-set-name:
    - address: "..."
    # ... more accounts

groups:
  - id: group-with-a-long-id
    accountSetNames: [account-set-name]
    # Group settings
```

Every group needs `chains`, `accountSetNames`, and — if it monitors anything — `monitors` and `notifications`. All of these except `accountSetNames` can come from `defaults`.

## Account Sets

Account sets let you define accounts once and reference them from several groups. Accounts exist **only** inside account sets; groups never list them inline.

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

Monitor settings placed on an account (`commission`, `threshold`, `display`, …) override the group's values for that account.

## Groups

```yaml
groups:
  - id: validators-group-kusama
    chains:
      - AssetHubKusama

    notifications:
      messengerType: Matrix
      channels: ['!customroom:matrix.org']

    monitors:
      - name: Staking
        commission: 7
        handlers: [CommissionUnexpectedState]
      - name: Balances
        threshold: "500.75"
        handlers: [BalanceThresholdState]

    accountSetNames: [validators-set]
```

- `id` — slug (lowercase letters, digits, hyphens; starts with a letter), longer than 16 characters, unique across all files. It identifies the group in incidents, so keep it stable and descriptive.
- `chains` — one group is created per chain, each monitoring the same accounts. Handlers only run on chains their monitor supports (see [Monitors & Handlers Reference](./MONITORS.md)); note that most on-chain activity now lives on the Asset Hubs, not the relay chains.
- `accountSetNames` — one or more account set names; all their accounts are monitored by the group.
- `monitors` — each entry needs `name` and at least one `handler`.
- `notifications` — where incidents go; required whenever the group has monitors.

## Defaults

```yaml
defaults:
  chains:
    - AssetHubPolkadot
    - AssetHubKusama

  notifications:
    messengerType: Matrix
    channels: ['!roomid:matrix.org']
    needsAck: true
    repeatFiringMs: 3600000

  monitors:
    - name: Staking
      commission: 10
      handlers:
        - CommissionChangedEvent
        - OffenceReportedEvent
```

Defaults are replaced, not merged: a group that defines `monitors` ignores `defaults.monitors` entirely.

## Settings Hierarchy

Monitor settings are resolved in this order, most specific first:

1. **Account level** — settings on an account in an account set
2. **Group level** — settings in the group's `monitors`
3. **Default level** — settings in `defaults.monitors`

```yaml
defaults:
  monitors:
    - name: Staking
      commission: 10          # applies to all groups without their own monitors
      handlers: [CommissionUnexpectedState]

groups:
  - id: validators-group-polkadot
    monitors:
      - name: Staking
        commission: 7         # applies to this group
        handlers: [CommissionUnexpectedState]
    accountSetNames: [validators-set]

accountSets:
  validators-set:
    - address: "..."
      commission: 3           # applies to this account only
```

## Notifications

```yaml
notifications:
  messengerType: Matrix
  channels: ['!roomid:matrix.org']
  needsAck: true
  repeatFiringMs: 3600000                             # optional
  escalationChannels: ['!escalationroom:matrix.org']  # optional
  escalationTimeoutMs: 3600000                        # optional
```

- `channels` — at least one Matrix room, in `!roomid:server.name` format (Matrix is the only messenger currently supported)
- `needsAck` — see [above](#incidents-one-concept-two-properties); defaults to `false`
- `repeatFiringMs` — re-send an incident that is still firing after this many **milliseconds**
- `escalationChannels` + `escalationTimeoutMs` — notify these channels when an incident with `needsAck: true` has not been acknowledged for that many milliseconds. Escalation needs **both** fields; with either missing, nothing escalates.

## Operations: Payouts

`operations.payout` marks accounts whose staking rewards the [Payouts service](../payouts/README.md) should claim. It can sit on `defaults`, a group, or an account (most specific wins), and is independent of monitoring — a group can be payout-only, without `monitors` or `notifications`.

```yaml
groups:
  - id: payouts-validators-polkadot
    chains: [AssetHubPolkadot]
    accountSetNames: [validators-set]
    operations:
      payout:
        signer: signer-x                              # optional
        notifications:                                # optional
          messengerType: Matrix
          channels: ['!payoutsroom:matrix.org']
```

- `signer` — name of a signer defined in the Payouts service config, which holds the actual secret. Every payout account must resolve to one, from the account, group, or defaults.
- `notifications` — where payout results go; falls back to the group's `notifications`.

## Annotations

`annotations` can be set on a group, monitor, or account to store arbitrary metadata for external tools. It bypasses validation and follows the same override rules as other settings.

```yaml
groups:
  - id: validators-group-polkadot
    annotations:
      owner: secops
    monitors:
      - name: Staking
        handlers: [CommissionUnexpectedState]
        annotations:
          tag: red
    accountSetNames: [validators-set]
```

## Value Formats & Validation

### Addresses

- SS58 (47-48 characters) or hex (64 characters prefixed with `0x`)
- Automatically converted to the chain-specific SS58 format

### Balance Values

- Strings with an optional decimal point, e.g. `"100.5"`, `"1000"`
- Token units (DOT/KSM), not planks — converted to chain-specific bigint values
- Example: `"0.1"` DOT = `1000000000n` planks (0.1 * 10^10)

## Configuration Processing

1. **Load and validate** — file structure, required fields, and the format of addresses, decimals, handlers, and tokens
2. **Transform** — generate account names if absent, convert addresses to chain-specific SS58, convert decimal balances to bigint
3. **Group** — create one group per chain, apply the settings hierarchy, and build the per-account monitor settings

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
    - AssetHubPolkadot
  notifications:
    messengerType: Matrix
    channels: ['!roomid:matrix.org']
    needsAck: true

groups:
  - id: validators-staking-with-ack
    monitors:
      - name: Staking
        commission: 5
        handlers:
          - CommissionUnexpectedState
          - OffenceReportedEvent
      - name: Balances
        threshold: "1000.0"
        handlers:
          - BalanceThresholdState
          - TransferIngressEvent
    accountSetNames: [validators-set]

  - id: validators-transfers-no-ack
    monitors:
      - name: Balances
        handlers:
          - TransferEgressEvent
    notifications:
      messengerType: Matrix
      channels: ['!roomid:matrix.org']
      needsAck: false
      repeatFiringMs: 604800000
    accountSetNames: [validators-set]
```

For a complete reference of all available monitors and handlers, see the [Monitors & Handlers Reference](./MONITORS.md).
