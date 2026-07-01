# @w3f/polguard-payouts

A one-shot CLI that automatically claims Polkadot/Kusama validator staking rewards. An optional
PolGuard **operations** component — it can run standalone or alongside monitoring.

It is the only PolGuard component that holds a signing key; use keys funded with just enough to cover
transaction fees.

## How it works

1. Loads its app config (`config/config.yaml`).
2. Resolves the accounts to claim for from the shared monitoring config files via.
3. Groups by chain then signer.
4. For each signer group, scans the claimable era window and submits `payout_stakers_by_page`
   transaction per unclaimed reward page.
5. Reports to stdout always, and posts a summary to other notification channels (ex. matrix) when configured.
6. Exits non-zero if any signer group fails.

Claiming is idempotent: on-chain `ClaimedRewards` is the source of truth each run, so a missed run
self-heals on the next one. No local state, no in-process retries.

## Configuration

Two configs:

- **App config** (`config/config.yaml`) — RPC URLs per chain, signer mnemonics, claim knobs, optional
  Matrix URL. See [config.yaml.example](./config/config.yaml.example).
- **Accounts config** — the shared monitoring YAML files (`payoutConfigsDir`); accounts to claim for
  are any group. See the [Config Guide](../config/CONFIG_GUIDE.md).

## Development

```bash
yarn build
yarn start:dev
yarn test
```

Uses [PAPI](https://papi.how/) for chain access and signing; descriptors live in `.papi/` and are
built via the `postinstall` script.
