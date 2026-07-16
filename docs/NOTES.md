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

**Why it exists.** The pjs→papi migration regressed block processing from ~100–300ms to 2.5–4s (against a 2s block time, ~600 monitored accounts) with memory climbing. Suspected cause: PAPI 2.0.1's typed `getValues()` opens one `chainHead_v1_storage` operation *per key*, so hundreds per block serialize behind the node's concurrent-operation limit. The two batched engines send a single call instead; the `getValues` engine reproduces the original per-key path for direct comparison. The deciding test is the staging A/B/C comparison below.

**Staging A/B/C comparison (Grafana, 5-day window, `polguard-stage`).** Three long-lived pods, one per engine, running side by side against the same live chain.

**Pod hardware.** All three variants get identical resources (stage `chainServices` config): requests `1000m` CPU / `768Mi` memory, limits `1500m` CPU / `1024Mi` memory.

| Metric | `chainHead` (default) | `legacyRpc` | `getValues` (unbatched) |
|---|---|---|---|
| Block processing time | ~0.9–1.3s, stable throughout | ~1–1.5s baseline; degrades to 2.5–3.5s during two multi-hour windows | ~2–3s baseline with rising variance, peaks near 6s |
| CPU (mean / max) | 0.68 / 1.01 cores | 0.87 / 1.48 cores — plateaus at ~1.45–1.48 during degradation windows | 1.40 / 1.47 cores — pinned near its apparent ~1.5-core ceiling almost continuously |
| Memory (mean / max) | 377 / 606 MiB, frequent short dips to 200–300MiB (looks like GC/sampling, not restarts — CPU/latency don't reset at the same moments) | 561 / 644 MiB, gradual growth then sudden drops around Jul 12/14/15 (restarts/rollouts) | 597 / 656 MiB, highest baseline; grows after resets then flattens near 630MiB — bounded, not runaway |
| Event-loop delay | ~0.4–0.7s, no sustained spikes | usually <1s, climbs to 2.5–3.2s exactly when CPU plateaus | ~0.8–1.5s baseline, rises to 2–3.5s |

Outcome: `chainHead` has the lowest latency and clear CPU/memory headroom — confirms it as the correct default. `legacyRpc` is fine at baseline but becomes CPU-bound during specific windows (CPU plateaus at ~1.45–1.48 cores), with block time and event-loop delay degrading in lockstep exactly when that happens — workload-triggered saturation, not constant. `getValues` is chronically CPU-constrained (pinned near its ~1.5-core ceiling almost continuously), which is the likely root cause of its consistently higher block time, highest memory, and worst event-loop delay. Memory growth on `legacyRpc`/`getValues` plateaus rather than climbing indefinitely, so it reads as a higher steady-state footprint for those engines rather than a confirmed leak.