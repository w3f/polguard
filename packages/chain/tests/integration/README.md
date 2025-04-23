# Integration Testing Framework

This framework allows testing the Chain Watcher service against real blockchain data. It connects to real blockchain nodes and verifies that handlers correctly identify and process the conditions they're designed to detect.

## Configuration

Tests are defined in the `test-config.yaml` file. The configuration includes:

- RPC endpoints for different chains
- Test scenarios organized by monitor type and handler

Example configuration:

```yaml
rpcEndpoints:
  Polkadot: "wss://rpc.polkadot.io"
  Kusama: "wss://kusama-rpc.polkadot.io"

tests:
  Staking:
    CommissionChanged:
      - chain: "Polkadot"
        block: 12345678
        account:
          address: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
          commission: 5
```

## Running Tests

To run the integration tests:

```bash
# From the chain package directory
yarn test:integration

# Or directly with ts-node
npx ts-node tests/integration/index.ts
```

## Adding New Tests

1. Identify a block where a specific handler should trigger
2. Add the test to the `test-config.yaml` file under the appropriate monitor and handler
3. Include any handler-specific settings required for the test

## How It Works

The framework:

1. Connects to the specified blockchain node
2. Creates a test monitoring group with the specified account and handler
3. Initializes the ChainWatcher with the test group
4. Processes the specified block
5. Checks if an incident was created for the account and handler

## Test Results

The test runner outputs a summary of test results, including:

- Results by handler
- Overall pass/fail statistics
- Detailed error information for failed tests
