# Payouts integration test

Exercises the **full pipeline** against live Polkadot Asset Hub — config parsing, the payout
resolver, the planner, and the claim engine:

1. Discovers validators **on chain** that have unclaimed reward pages in the claimable window.
2. Writes a temp accounts file + app `config.yaml` from those validators.
3. Loads them through the real `loadConfig` → `getPayoutAccounts` → `buildPlan` path.
4. Runs `claimGroup` and asserts at least one claim is submitted.
5. Re-runs `claimGroup` and asserts the second run is idempotent (nothing left to claim).

The generated config is written to a temp dir and removed afterwards; nothing is committed.

## Running

```sh
PAYOUTS_TEST_SEED="<twelve word mnemonic>" yarn workspace @w3f/polguard-payouts test:integration
```

The derived account must hold DOT to pay fees. With `PAYOUTS_TEST_SEED` unset the test logs a skip
and exits 0.
