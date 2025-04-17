# Development Notes

This document contains important development decisions and future considerations for the Monitoring Platform.

## Architectural Decisions

### Code Organization

For most services, we've intentionally split the NestJS implementation from the core business logic to avoid tight coupling. This separation allows for:

- Easier testing of business logic without NestJS dependencies
- Potential reuse of business logic in different contexts
- Clearer separation of concerns
- Possibility to migrate from NestJS to other backend frameworks in the future

### Telemetry and Chain Separation

Telemetry is not focused on real-time processing like the chain monitoring. It remains part of the repository as we don't yet have general batch processing tools, or offline reports/dashboards for non-real-time data analysis. The code duplication between telemetry and chain watcher implementations is considered acceptable given the temporary nature of the current telemetry implementation.

## Future Considerations and Known Issues

### Runtime Environment

Long-term, we may consider moving from Node.js to Deno for the following reasons:

- Better security model
- Native TypeScript support
- Modern JavaScript features
- Improved dependency management

However, this would require significant changes to the codebase and would need to address the NestJS compatibility issues.

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
