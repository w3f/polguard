import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { createChainDataProvider } from '../../src/lib/data-provider';
import { ChainWatcher } from '../../src/lib/watcher';
import { Chain, MonitorType, MonitoringGroup, MessengerType, getChainProperties, ChainApiClient } from '@w3f/monitoring-types';
import { LoggerAdapter, MockKeyValueStorage, TestIncidentHandler, ApiConnectionManager, colors } from './test-utils';

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
  private connectionManager: ApiConnectionManager;
  
  constructor(private configPath: string) {}
  
  async run(): Promise<TestResult[]> {
    const config = this.loadConfig();
    this.connectionManager = new ApiConnectionManager(config.rpcEndpoints);
    
    try {
      // Flatten test cases for simpler processing
      const testCases = this.flattenTestCases(config);
      const results = await this.runTestCases(testCases);
      return results;
    } finally {
      await this.connectionManager.closeAll();
    }
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
  
  private async runTestCases(testCases: TestCase[]): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    for (const testCase of testCases) {
      console.log(`Testing ${testCase.monitor}.${testCase.handlerType} on ${testCase.chain} at block ${testCase.block}`);
      
      if (testCase.description) {
        console.log(`  Description: ${colors.yellow}${testCase.description}${colors.reset}`);
      }
      
      try {
        const success = await this.runTest(testCase);
        
        results.push({
          chain: testCase.chain,
          monitor: testCase.monitor,
          handlerType: testCase.handlerType,
          block: testCase.block,
          account: testCase.account.address,
          success
        });
        
        console.log(`  Result: ${success ? colors.green + 'PASS' + colors.reset : colors.red + 'FAIL' + colors.reset}`);
      } catch (error) {
        console.error(`  Error: ${error.message}`);
        
        results.push({
          chain: testCase.chain,
          monitor: testCase.monitor,
          handlerType: testCase.handlerType,
          block: testCase.block,
          account: testCase.account.address,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }
  
  private async runTest(testCase: TestCase): Promise<boolean> {
    const api = await this.connectionManager.getApi(testCase.chain);
    const logger = new LoggerAdapter();
    const storage = new MockKeyValueStorage();
    const incidentHandler = new TestIncidentHandler();
    
    // Setup chain watcher
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
    
    // Run the test
    await watcher.initializeMonitors();
    await watcher.processBlock(testCase.block);
    
    return incidentHandler.wasIncidentCreated(
      testCase.account.address,
      group.id,
      testCase.handlerType
    );
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
    const fileContents = fs.readFileSync(this.configPath, 'utf8');
    return yaml.load(fileContents);
  }
}
