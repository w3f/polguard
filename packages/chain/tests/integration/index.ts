import { TestRunner, TestResult } from './test-runner';
import { colors } from './test-utils';
import * as path from 'node:path';

async function main() {
  try {
    const args = process.argv.slice(2);
    const debugIndex = args.indexOf('--debug');
    const debug = debugIndex !== -1;

    if (debugIndex !== -1) args.splice(debugIndex, 1);

    const filterPattern = args.find(arg => !arg.startsWith('--')) || '';
    if (debug) console.log(`Debug mode enabled. Filter pattern: "${filterPattern}"`);

    const configPath = path.resolve(__dirname, 'test-config.yaml');
    const results = await new TestRunner(configPath).run(filterPattern, debug);

    printResults(results);

    const failedTests = results.filter(r => !r.success).length;
    process.exit(failedTests > 0 || results.length === 0 ? 1 : 0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

function printResults(results: TestResult[]): void {
  console.log('\nTest Results Summary:');
  console.log('=====================');

  const failedTests = results.filter(r => !r.success);
  if (failedTests.length > 0) {
    for (const test of failedTests) {
      console.log(
        `${colors.red}❌ ${test.monitor}.${test.handlerType} - ${test.chain} - Block ${test.block}${colors.reset}`,
      );
      if (test.error) console.log(`   Error: ${test.error}`);
    }
  }

  const handlerStats = summarizeByHandler(results);

  console.log('\nResults by Handler:');
  Object.entries(handlerStats).forEach(([handler, stats]) => {
    const passRate = Math.round((stats.passed / stats.total) * 100);
    const color = passRate === 100 ? colors.green : passRate > 50 ? colors.yellow : colors.red;
    console.log(`${handler}: ${color}${stats.passed}/${stats.total} passed (${passRate}%)${colors.reset}`);
  });

  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const overallPassRate = Math.round((passedTests / totalTests) * 100);
  const overallColor = overallPassRate === 100 ? colors.green : overallPassRate > 50 ? colors.yellow : colors.red;

  console.log(`\nOverall: ${overallColor}${passedTests}/${totalTests} passed (${overallPassRate}%)${colors.reset}`);
}

function summarizeByHandler(results: TestResult[]): Record<string, { passed: number; total: number }> {
  const stats: Record<string, { passed: number; total: number }> = {};

  for (const result of results) {
    const key = `${result.monitor}.${result.handlerType}`;
    if (!stats[key]) stats[key] = { passed: 0, total: 0 };
    stats[key].total++;
    if (result.success) stats[key].passed++;
  }

  return stats;
}

if (require.main === module) main();
