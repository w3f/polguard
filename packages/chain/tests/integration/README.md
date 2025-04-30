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
# Run all tests
yarn test:integration

# Run tests for a specific monitor
yarn test:integration Staking

# Run a specific test handler
yarn test:integration Staking.SelfStakeUnexpected

# Run tests with debug output (shows application logs)
yarn test:integration --debug

# Combine filtering and debug mode
yarn test:integration Staking.SelfStakeUnexpected --debug
```

Tests run in parallel by default, grouped by chain to optimize API connections.

## Adding New Tests

1. Identify a block where a specific handler should trigger
2. Add the test to the `test-config.yaml` file under the appropriate monitor and handler
3. Include any handler-specific settings required for the test

## How It Works

The framework:

1. Groups tests by chain and runs them in parallel
2. Creates a single API connection per chain for all tests
3. Creates a test monitoring group with the specified account and handler
4. Initializes the ChainWatcher with the test group
5. Processes the specified block
6. Checks if an incident was created for the account and handler

By default, application logs are suppressed to keep the output clean. Use the `--debug` flag to see all logs.

## Test Results

The test runner outputs a summary of test results, including:

- Results by handler
- Overall pass/fail statistics
- Detailed error information for failed tests
