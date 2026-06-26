import pino from 'pino';
import { getPayoutAccounts } from '@w3f/polguard-config';
import { loadConfig } from './config';
import { buildPlan } from './planner';
import { createChainClient, getPayoutApi, signerFromMnemonic } from './papi';
import { claimCohort } from './claim-engine';

function createRootLogger(level: string): pino.Logger {
  return pino({
    level,
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
    },
  });
}

async function run(): Promise<number> {
  const config = loadConfig(createRootLogger('debug').child({ context: 'Config' }));
  const rootLogger = createRootLogger(config.logging.level);
  const logger = rootLogger.child({ context: 'Payouts' });

  const accounts = await getPayoutAccounts(config.payoutConfigsDir, rootLogger.child({ context: 'Config' }));
  logger.info(`Resolved ${accounts.length} payout account(s)`);

  const plan = buildPlan(accounts, { chains: config.chains, signers: config.signers }, logger);

  let anyFailure = false;
  for (const { chain, rpcUrl, cohorts } of plan) {
    const client = createChainClient(rpcUrl);
    try {
      const api = getPayoutApi(client, chain);
      for (const cohort of cohorts) {
        const cohortLogger = logger.child({ chain, signer: cohort.signer });
        try {
          const signer = signerFromMnemonic(config.signers[cohort.signer]);
          const submitted = await claimCohort(api, cohort.accounts, signer, config.claim, cohortLogger);
          cohortLogger.info({ submitted: submitted.length }, 'Cohort complete');
        } catch (error) {
          anyFailure = true;
          cohortLogger.error({ err: error }, 'Cohort failed');
        }
      }
    } finally {
      client.destroy();
    }
  }

  const cohortCount = plan.reduce((n, p) => n + p.cohorts.length, 0);
  logger.info(`Run complete: ${cohortCount} cohort(s), failures: ${anyFailure}`);
  return anyFailure ? 1 : 0;
}

run()
  .then(code => process.exit(code))
  .catch(error => {
    console.error('Payouts run failed:', error);
    process.exit(1);
  });
