# Development Notes

This document contains important development decisions and non-obvious architectural patterns in PolGuard.

## Architectural Decisions

### Code Organization

For most services, we've intentionally split the core business logic from the framework layer to avoid tight coupling. This separation allows for:

- Easier testing of business logic without framework dependencies
- Potential reuse of business logic in different contexts
- Clearer separation of concerns

The Chain service follows this pattern with `src/lib/` (core monitoring logic) and `src/service/` (framework-level implementations of Store/Reporter abstractions). The layers are loosely coupled through interfaces.

### Handler Registration System

The chain monitoring system uses TypeScript decorators to register handler methods for chain events, calls, and state checks. This approach provides a clean, declarative API for defining handlers, but introduces some complexity in the initialization process:

```typescript
@Event(H.TransferIngress, [Chain.AssetHubPolkadot, Chain.AssetHubKusama], 'balances.Transfer')
async balancesTransferIngress({ eventRecord, blockNumber, handler }) {
  // Handler implementation
}
```

The decorators store metadata about handlers on the class prototype at class definition time, before any instances are created. When a monitor instance is created, the `AbstractMonitor.initializeHandlers()` method reads this metadata, binds the handler methods to the instance, and stores them in the instance's handler maps.

This design decision prioritizes a simple interface for defining handlers over simpler initialization logic. While the decorator-based approach makes the code more readable and maintainable for developers implementing new monitors, it requires careful management of the prototype chain.

## Future Considerations and Known Issues

### Notification Formatting

Currently, notification handling logic exists in both the chain and Incident services. Ideally, only the Incident service should be responsible for the styling and formatting of notifications. This would simplify the chain service and maintain a consistent format across different notification consumers.

### Storage query engines (`chain.storageQueryEngine`)

`packages/chain/src/lib/storage-query.ts` resolves per-address storage lookups behind a config switch with three selectable engines:

- `chainHead` (default) — *batched*: one `chainHead_v1_storage` operation via PAPI's internal `___INTERNAL_DO_NOT_USE`.
- `legacyRpc` — *batched*: one `state_queryStorageAt` RPC call via `client._request`.
- `getValues` — *un-batched baseline*: PAPI's typed `runtimeClient.query.<Pallet>.<Storage>.getValues()`, which opens one `chainHead_v1_storage` operation *per key*. This is the pre-batching path; kept as a runtime-selectable engine (not just a separate bench harness) so it can be A/B/C'd against the two batched engines.

**Why it exists.** The pjs→papi migration regressed block processing from ~100–300ms to 2.5–4s (against a 2s block time, ~600 monitored accounts) with memory climbing. Suspected cause: PAPI 2.0.1's typed `getValues()` opens one `chainHead_v1_storage` operation *per key*, so hundreds per block serialize behind the node's concurrent-operation limit. The two batched engines send a single call instead; the `getValues` engine reproduces the original per-key path for direct comparison. The WAN benchmark below is inconclusive on whether batching is the real fix — the deciding test is the prod A/B/C comparison.

**Benchmarks (superseded above numbers - see methodology note).** Standalone harness (`packages/chain/tests/integration/bench.ts`, plus equivalent harnesses pointed at two other checkouts — see below) wraps `ChainWatcher.processBlock()` with `performance.now()` and drives it against real finalized blocks, using the actual production `companies.yaml` (3 groups, 146 unique accounts, Staking + Balances + Xcm monitors) on AssetHubPolkadot. 2-minute runs. Four variants compared:

- `chainHead` / `legacyRpc` — this repo's two batched engines (`storage-query.ts`).
- pjs (pre-migration) — the pjs checkout, harness bypasses NestJS/Incident/Matrix HTTP wiring entirely (groups loaded from a JSON dump of the same resolved `companies.yaml` groups).
- `getValues` (per-key) — current master *before* the batching fix, i.e. `runtimeClient.query.X.Y.getValues()` called directly per storage pallet (one `chainHead_v1_storage` operation per key), the actual regression this whole flag exists to fix.

To separate a real engine difference from RPC-provider noise (a single public endpoint may throttle/vary over a session, which would masquerade as an engine effect), we ran the first 3 variants through two independent public RPC endpoints in opposite order, then appended `getValues` afterwards on both endpoints (same order both times — A then B — since it was a follow-up addition, not interleaved with the original run):

| # | RPC endpoint | Order | Engine | n blocks | median | P90 | avg | min | max |
|---|---|---|---|---|---|---|---|---|---|
| 1 | polkadot-asset-hub-rpc.polkadot.io | 1st | `chainHead` | 59 | 1222ms | 1948ms | 1300ms | 623ms | 2364ms |
| 2 | polkadot-asset-hub-rpc.polkadot.io | 2nd | `legacyRpc` | 48 | 1979ms | 3177ms | 2118ms | 539ms | 5444ms |
| 3 | polkadot-asset-hub-rpc.polkadot.io | 3rd | pjs (pre-migration) | 38 | 682ms | 1180ms | 819ms | 405ms | 3277ms |
| 4 | rpc-asset-hub-polkadot.luckyfriday.io | 1st (reversed) | pjs (pre-migration) | 38 | 1249ms | 1610ms | 1332ms | 1169ms | 2257ms |
| 5 | rpc-asset-hub-polkadot.luckyfriday.io | 2nd (reversed) | `legacyRpc` | 71 | 1656ms | 1729ms | 1673ms | 1569ms | 2202ms |
| 6 | rpc-asset-hub-polkadot.luckyfriday.io | 3rd (reversed) | `chainHead` | 50 | 1633ms | 1879ms | 1621ms | 1028ms | 2041ms |
| 7 | polkadot-asset-hub-rpc.polkadot.io | follow-up | `getValues` (per-key) | 61 | 1204ms | 2727ms | 1487ms | 760ms | 7071ms |
| 8 | rpc-asset-hub-polkadot.luckyfriday.io | follow-up | `getValues` (per-key) | 57 | 1723ms | 1974ms | 1736ms | 1327ms | 2096ms |