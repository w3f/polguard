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

### Database Migrations

The Incident service runs Drizzle migrations on application startup (`migrate(db, { migrationsFolder: './drizzle' })`). This is simple and works well for a single-pod deployment. If the service were scaled to multiple replicas, a separate migration job or an advisory-lock strategy would be needed to avoid race conditions during schema changes.
