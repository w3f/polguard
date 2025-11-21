# Development Notes

This document contains important development decisions and future considerations for PolGuard.

## Architectural Decisions

### Code Organization

For most services, we've intentionally split the NestJS implementation from the core business logic to avoid tight coupling. This separation allows for:

- Easier testing of business logic without NestJS dependencies
- Potential reuse of business logic in different contexts
- Clearer separation of concerns
- Possibility to migrate from NestJS to other backend frameworks in the future

The Chain service follows this pattern with `src/lib/` (core monitoring logic) and `src/service/` (NestJS implementations of Store/Reporter abstractions). The layers are loosely coupled through interfaces.

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

### Polkadot Chain Libraries Support

The `lib/` layer is currently coupled with Polkadot.js throughout (API calls, types, event processing). Future work could abstract blockchain interactions to support multiple Polkadot chain libraries (dedot, papi, etc.) by introducing an adapter layer between `lib/` and blockchain SDKs.

### NestJS and Module System

We are not using all the features from NestJS; instead, we mostly use our own abstractions. Something simpler should work better, especially considering CommonJS limitations that restrict our ability to use modern ES modules and create compatibility issues with some dependencies.

### Runtime Environment (Deno)

Deno is only a consideration at this point, not a plan. If we were to explore it in the future, potential benefits could include:

- Better security model
- Native TypeScript support
- Modern JavaScript features
- Improved dependency management

However, this would require significant changes to the codebase and would need to address framework compatibility.

### Matrix SDK Limitations

We are currently stuck with matrix-js-sdk version 32 due to compatibility issues with newer versions that appear incompatible with CommonJS. After some attempts to resolve this, we decided to handle it later. This issue might be fixable but requires further investigation.

### API Authorization

As the platform evolves, we may need to implement proper API authorization for external clients that need to access the Incident service, such as:

- Dashboards for incident visualization
- Third-party services interested in monitoring configurations

### Database Migrations

We use `start:with-migrations` script in production with a single pod deployment. This approach runs migrations before starting the Incident service, which is simple but would have limitations if we scaled to multiple pods (race conditions, schema conflicts during updates). For now, this approach is sufficient for our needs.
