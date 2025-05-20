# Development Notes

This document contains important development decisions and future considerations for the Monitoring Platform.

## Architectural Decisions

### Code Organization

For most services, we've intentionally split the NestJS implementation from the core business logic to avoid tight coupling. This separation allows for:

- Easier testing of business logic without NestJS dependencies
- Potential reuse of business logic in different contexts
- Clearer separation of concerns
- Possibility to migrate from NestJS to other backend frameworks in the future

### Handler Registration System

The chain monitoring system uses TypeScript decorators to register handler methods for chain events, calls, and state checks. This approach provides a clean, declarative API for defining handlers, but introduces some complexity in the initialization process:

```typescript
@Event(H.TransferIngress, [Chain.Polkadot, Chain.Kusama], 'balances.Transfer')
async balancesTransferIngress({ eventRecord, blockNumber, handler }) {
  // Handler implementation
}
```

The decorators store metadata about handlers on the class prototype at class definition time, before any instances are created. When a monitor instance is created, the `AbstractMonitor.initializeHandlers()` method reads this metadata, binds the handler methods to the instance, and stores them in the instance's handler maps.

This design decision prioritizes a simple interface for defining handlers over simpler initialization logic. While the decorator-based approach makes the code more readable and maintainable for developers implementing new monitors, it requires careful management of the prototype chain.

### Telemetry and Chain Separation

Telemetry is not focused on real-time processing like the chain monitoring. It remains part of the repository as we don't yet have general batch processing tools, or offline reports/dashboards for non-real-time data analysis. The code duplication between telemetry and chain watcher implementations is considered acceptable given the temporary nature of the current telemetry implementation.

## Future Considerations and Known Issues

### Storage Implementation

Initially, the platform used Redis for key-value storage. To simplify infrastructure requirements, we replaced it with node-persist, a file-based storage solution. This works well for our current needs (a few hundred keys), but be aware that node-persist lacks file-level locking, which could cause data corruption if multiple processes access the same storage directory.

### Runtime Environment

Long-term, we may consider moving from Node.js to Deno for the following reasons:

- Better security model
- Native TypeScript support
- Modern JavaScript features
- Improved dependency management

However, this would require some changes to the codebase and would need to address the NestJS compatibility issues.

### Matrix SDK Limitations

We are currently stuck with matrix-js-sdk version 32 due to compatibility issues with newer versions that appear incompatible with CommonJS. After some attempts to resolve this, we decided to handle it later. This issue might be fixable but requires further investigation.

### NestJS and Module System

NestJS currently only supports CommonJS, which creates limitations:

- Restricts our ability to use modern ES modules
- Creates compatibility issues with some dependencies

### API Authorization

As the platform evolves, we may need to implement proper API authorization for external clients that need to access the API service, such as:

- Dashboards for incident visualization
- Third-party services interested in monitoring configurations (ex. [payout claimer](https://github.com/w3f/polkadot-k8s-payouts), [telemetry exporter](https://github.com/w3f/telemetry-exporter))

### Database Migrations

We use `start:with-migrations` script in production with a single pod deployment. This approach runs migrations before starting the API service, which is simple but would have limitations if we scaled to multiple pods (race conditions, schema conflicts during updates). For now, this approach is sufficient for our needs.
