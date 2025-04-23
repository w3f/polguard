import { TestRunner, TestResult } from './test-runner';
import { colors } from './test-utils';
import * as path from 'path';

async function main() {
  try {
    const configPath = path.resolve(__dirname, 'test-config.yaml');
    const testRunner = new TestRunner(configPath);
    const results = await testRunner.run();
    
    printResults(results);
    
    const failedTests = results.filter(r => !r.success).length;
    process.exit(failedTests > 0 ? 1 : 0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

function printResults(results: TestResult[]): void {
  console.log('\nTest Results Summary:');
  console.log('=====================');
  
  // Print failed tests
  const failedTests = results.filter(r => !r.success);
  if (failedTests.length > 0) {
    for (const test of failedTests) {
      console.log(`${colors.red}❌ ${test.monitor}.${test.handler} - ${test.chain} - Block ${test.block}${colors.reset}`);
      if (test.error) {
        console.log(`   Error: ${test.error}`);
      }
    }
  }
  
  // Group results by handler
  const handlerStats = summarizeByHandler(results);
  
  // Print handler stats
  console.log('\nResults by Handler:');
  Object.entries(handlerStats).forEach(([handler, stats]) => {
    const passRate = Math.round((stats.passed / stats.total) * 100);
    const color = getColorForPassRate(passRate);
    console.log(`${handler}: ${color}${stats.passed}/${stats.total} passed (${passRate}%)${colors.reset}`);
  });
  
  // Print overall stats
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const overallPassRate = Math.round((passedTests/totalTests)*100);
  const overallColor = getColorForPassRate(overallPassRate);
  
  console.log(`\nOverall: ${overallColor}${passedTests}/${totalTests} passed (${overallPassRate}%)${colors.reset}`);
}

function summarizeByHandler(results: TestResult[]): Record<string, { passed: number; total: number }> {
  const stats: Record<string, { passed: number; total: number }> = {};
  
  for (const result of results) {
    const key = `${result.monitor}.${result.handler}`;
    
    if (!stats[key]) {
      stats[key] = { passed: 0, total: 0 };
    }
    
    stats[key].total++;
    if (result.success) {
      stats[key].passed++;
    }
  }
  
  return stats;
}

function getColorForPassRate(passRate: number): string {
  return passRate === 100 ? colors.green : passRate > 50 ? colors.yellow : colors.red;
}

if (require.main === module) {
  main();
}
