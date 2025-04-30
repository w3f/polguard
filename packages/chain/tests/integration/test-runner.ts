import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { createChainDataProvider } from '../../src/lib/data-provider';
import { ChainWatcher } from '../../src/lib/watcher';
import { Chain, MonitorType, MonitoringGroup, MessengerType, getChainProperties, ChainApiClient } from '@w3f/monitoring-types';
import { LoggerAdapter, MockKeyValueStorage, TestIncidentHandler, colors } from './test-utils';
import { ApiPromise, WsProvider } from '@polkadot/api';

export interface TestCase {
  chain: Chain;
  monitor: MonitorType;
  handlerType: string;
  block: number;
  account: any;
  description?: string;
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
  
  async run(filterPattern: string = '', debug: boolean = false): Promise<TestResult[]> {
    const config = this.loadConfig();
    
    try {
      let testCases = this.flattenTestCases(config);
      
      if (filterPattern) {
        testCases = this.filterTestCases(testCases, filterPattern);
        console.log(`Filtered to ${testCases.length} tests matching pattern: ${filterPattern}`);
      }
      
      const testCasesByChain = this.groupByChain(testCases);
      
      const chainResults = await Promise.all(
        Object.entries(testCasesByChain).map(([chain, chainTestCases]) => 
          this.runChainTests(chain as Chain, chainTestCases, config.rpcEndpoints[chain], debug)
        )
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
        : testCase.monitor === monitorName
    );
  }
  
  private groupByChain(testCases: TestCase[]): Record<string, TestCase[]> {
    return testCases.reduce((groups, testCase) => {
      if (!groups[testCase.chain]) groups[testCase.chain] = [];
      groups[testCase.chain].push(testCase);
      return groups;
    }, {} as Record<string, TestCase[]>);
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
            description: test.description
          });
        }
      }
    }
    
    return testCases;
  }
  
  private async runChainTests(chain: Chain, testCases: TestCase[], rpcEndpoint: string, debug: boolean): Promise<TestResult[]> {
    console.log(`\n${colors.cyan}Running ${testCases.length} tests for ${chain}...${colors.reset}`);
    console.log(`Connecting to ${chain} at ${rpcEndpoint}`);
    
    const api = await ApiPromise.create({ 
      provider: new WsProvider(rpcEndpoint), 
      noInitWarn: true 
    });
    
    try {
      const concurrencyLimit = 5;
      const results: TestResult[] = [];
      
      for (let i = 0; i < testCases.length; i += concurrencyLimit) {
        const batch = testCases.slice(i, i + concurrencyLimit);
        const batchResults = await Promise.all(
          batch.map(testCase => this.runSingleTest(testCase, api, debug))
        );
        results.push(...batchResults);
      }
      
      return results;
    } finally {
      console.log(`Disconnecting from ${chain}`);
      await api.disconnect();
    }
  }
  
  private async runSingleTest(testCase: TestCase, api: ApiPromise, debug: boolean): Promise<TestResult> {
    const testId = `${testCase.monitor}.${testCase.handlerType}`;
    
    try {
      const logger = new LoggerAdapter(console, debug);
      const storage = new MockKeyValueStorage();
      const incidentHandler = new TestIncidentHandler(testId);
      
      const chainProvider = createChainDataProvider(api, storage, logger);
      const group = this.createMonitoringGroup(
        testCase.chain, 
        testCase.monitor, 
        testCase.handlerType, 
        testCase.account
      );
      
      const watcher = new ChainWatcher(
        logger,
        { getMonitoringGroups: async () => [group] },
        api as ChainApiClient,
        incidentHandler,
        storage,
        getChainProperties(testCase.chain),
        chainProvider
      );
      
      await watcher.initializeMonitors();
      await watcher.processBlock(testCase.block);
      
      const success = incidentHandler.wasIncidentCreated(
        testCase.account.address,
        group.id,
        testCase.handlerType
      );
      
      return {
        chain: testCase.chain,
        monitor: testCase.monitor,
        handlerType: testCase.handlerType,
        block: testCase.block,
        account: testCase.account.address,
        success
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
        error: error.message
      };
    }
  }
  
  private createMonitoringGroup(
    chain: Chain,
    monitorType: MonitorType,
    handlerType: string,
    account: any
  ): MonitoringGroup {
    return {
      id: `test-group-${handlerType}`,
      chain,
      monitors: [
        {
          name: monitorType,
          settings: {
            handlers: [handlerType as any]
          }
        }
      ],
      accounts: [
        {
          ss58: account.address,
          hex: '',
          name: `Test Account ${account.address.substring(0, 8)}`,
          [monitorType]: {
            ...account,
            handlers: [handlerType as any]
          }
        }
      ],
      notifications: {
        messengerType: MessengerType.Matrix,
        channels: ['!test:matrix.org']
      }
    };
  }
  
  private loadConfig(): any {
    return yaml.load(fs.readFileSync(this.configPath, 'utf8'));
  }
}
