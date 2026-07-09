import * as fs from 'node:fs';
import yaml from 'js-yaml';
import { createChainDataProvider } from '../../src/lib/data-provider';
import { StorageQueryEngine } from '../../src/lib/storage-query';
import { ChainWatcher } from '../../src/lib/watcher';
import { Chain, MonitorType, MonitoringGroup, MessengerType, getChainProperties } from '@w3f/polguard-common';
import { LoggerAdapter, TestIncidentHandler, colors } from './test-utils';
import { InMemoryStore } from '../../src/service/store/in-memory.store';
import type { PolkadotClient } from 'polkadot-api';
import { getTypedApi } from '../../src/service/papi-descriptors';
import { ChainConnection } from '../../src/service/chain-connection';

export interface TestCase {
  chain: Chain;
  monitor: MonitorType;
  handlerType: string;
  block: number;
  account: any;
  description?: string;
  expectedIncidents?: number;
}

export interface TestResult {
  chain: Chain;
  monitor: MonitorType;
  handlerType: string;
  block: number;
  account: string;
  success: boolean;
  error?: string;
}

export class TestRunner {
  constructor(private configPath: string) {}

  async run(filterPattern: string = '', debug: boolean = false, chainFilter: string = ''): Promise<TestResult[]> {
    const config = this.loadConfig();

    try {
      let testCases = this.flattenTestCases(config);

      if (chainFilter) {
        testCases = this.filterTestCasesByChain(testCases, chainFilter);
        console.log(`Filtered to ${testCases.length} tests for chain: ${chainFilter}`);
      }

      if (filterPattern) {
        testCases = this.filterTestCases(testCases, filterPattern);
        console.log(`Filtered to ${testCases.length} tests matching pattern: ${filterPattern}`);
      }

      const testCasesByChain = this.groupByChain(testCases);

      const chainResults = await Promise.all(
        Object.entries(testCasesByChain).map(([chain, chainTestCases]) =>
          this.runChainTests(chain as Chain, chainTestCases, config.rpcEndpoints[chain], debug),
        ),
      );

      return chainResults.flat();
    } catch (error) {
      console.error('Error running tests:', error);
      throw error;
    }
  }

  private filterTestCases(testCases: TestCase[], pattern: string): TestCase[] {
    const [monitorName, handlerName] = pattern.split('.');

    return testCases.filter(testCase =>
      handlerName
        ? testCase.monitor === monitorName && testCase.handlerType === handlerName
        : testCase.monitor === monitorName,
    );
  }

  private filterTestCasesByChain(testCases: TestCase[], chainName: string): TestCase[] {
    return testCases.filter(testCase => testCase.chain === chainName);
  }

  private groupByChain(testCases: TestCase[]): Record<string, TestCase[]> {
    return testCases.reduce(
      (groups, testCase) => {
        if (!groups[testCase.chain]) groups[testCase.chain] = [];
        groups[testCase.chain].push(testCase);
        return groups;
      },
      {} as Record<string, TestCase[]>,
    );
  }

  private flattenTestCases(config: any): TestCase[] {
    const testCases: TestCase[] = [];

    for (const [monitorName, handlerTests] of Object.entries(config.tests)) {
      const monitor = monitorName as MonitorType;

      for (const [handlerName, tests] of Object.entries(handlerTests as any)) {
        for (const test of tests as any[]) {
          testCases.push({
            chain: test.chain as Chain,
            monitor,
            handlerType: handlerName,
            block: test.block,
            account: test.account,
            description: test.description,
            expectedIncidents: test.expectedIncidents || 1,
          });
        }
      }
    }

    return testCases;
  }

  private async runChainTests(
    chain: Chain,
    testCases: TestCase[],
    rpcEndpoints: string | string[],
    debug: boolean,
  ): Promise<TestResult[]> {
    console.log(`\n${colors.cyan}Running ${testCases.length} tests for ${chain}...${colors.reset}`);
    console.log(`Connecting to ${chain} at ${[rpcEndpoints].flat().join(', ')}`);
    const conn = await ChainConnection.connect(rpcEndpoints, new LoggerAdapter(console, debug));
    const client = conn.client;

    try {
      const concurrencyLimit = 5;
      const results: TestResult[] = [];

      for (let i = 0; i < testCases.length; i += concurrencyLimit) {
        const batch = testCases.slice(i, i + concurrencyLimit);
        const batchResults = await Promise.all(batch.map(testCase => this.runSingleTest(testCase, client, debug)));
        results.push(...batchResults);
      }

      return results;
    } finally {
      console.log(`Disconnecting from ${chain}`);
      conn.destroy();
    }
  }

  private async runSingleTest(testCase: TestCase, client: PolkadotClient, debug: boolean): Promise<TestResult> {
    const testId = `${testCase.monitor}.${testCase.handlerType}`;

    try {
      const logger = new LoggerAdapter(console, debug);
      const store = new InMemoryStore(logger);
      const incidentHandler = new TestIncidentHandler(testId);

      const runtimeClient = getTypedApi(client, testCase.chain);
      // Override via CHAIN_STORAGE_QUERY_ENGINE=legacyRpc to verify the alternative engine against
      // this same suite - see docs/STORAGE_QUERY_ENGINES.md.
      const storageQueryEngine = process.env.CHAIN_STORAGE_QUERY_ENGINE as StorageQueryEngine | undefined;
      const chainProvider = createChainDataProvider(
        client,
        runtimeClient,
        store,
        logger,
        testCase.chain,
        storageQueryEngine,
      );
      const group = this.createMonitoringGroup(
        testCase.chain,
        testCase.monitor,
        testCase.handlerType,
        testCase.account,
      );

      const watcher = new ChainWatcher(
        logger,
        { getMonitoringGroups: async () => [group] },
        store,
        client,
        runtimeClient,
        incidentHandler,
        getChainProperties(testCase.chain),
        chainProvider,
      );

      await watcher.initializeMonitors();
      await watcher.processBlock(testCase.block);

      const actualIncidents = incidentHandler.getIncidentCount(
        testCase.account.address,
        group.id,
        testCase.handlerType,
      );

      const expectedIncidents = testCase.expectedIncidents || 1;
      const success = actualIncidents === expectedIncidents;

      if (debug || !success) {
        console.log(
          `${colors.yellow}[${testId}] Expected ${expectedIncidents} incident(s), got ${actualIncidents}${colors.reset}`,
        );
      }

      return {
        chain: testCase.chain,
        monitor: testCase.monitor,
        handlerType: testCase.handlerType,
        block: testCase.block,
        account: testCase.account.address,
        success,
      };
    } catch (error) {
      console.error(`${colors.red}[${testId}] Error: ${error.message}${colors.reset}`);

      return {
        chain: testCase.chain,
        monitor: testCase.monitor,
        handlerType: testCase.handlerType,
        block: testCase.block,
        account: testCase.account.address,
        success: false,
        error: error.message,
      };
    }
  }

  private createMonitoringGroup(
    chain: Chain,
    monitorType: MonitorType,
    handlerType: string,
    account: any,
  ): MonitoringGroup {
    return {
      id: `test-group-${handlerType}`,
      chain,
      monitors: [
        {
          name: monitorType,
          settings: {
            handlers: [handlerType as any],
          },
        },
      ],
      accounts: [
        {
          ss58: account.address,
          hex: '',
          name: `Test Account ${account.address.substring(0, 8)}`,
          [monitorType]: {
            ...account,
            handlers: [handlerType as any],
          },
        },
      ],
      notifications: {
        messengerType: MessengerType.Matrix,
        channels: ['!test:matrix.org'],
      },
    };
  }

  private loadConfig(): any {
    return yaml.load(fs.readFileSync(this.configPath, 'utf8'));
  }
}
