import pino from 'pino';
import { getPayoutAccounts } from '@w3f/polguard-config';
import { ConfigService } from './config.service';
import { buildPlan } from './planner';

function createRootLogger(level: string): pino.Logger {
  return pino({
    level,
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
    },
  });
}

async function run() {
  const bootLogger = createRootLogger('debug');
  const config = new ConfigService(bootLogger.child({ context: 'Config' }));

  const rootLogger = createRootLogger(config.getLoggingLevel());
  const logger = rootLogger.child({ context: 'Payouts' });

  const accounts = await getPayoutAccounts(config.getPayoutConfigsDir(), rootLogger.child({ context: 'Config' }));
  logger.info(`Resolved ${accounts.length} payout account(s)`);

  const cohorts = buildPlan(accounts, { chains: config.getChains(), signers: config.getSigners() });

  for (const cohort of cohorts) {
    logger.info(
      { chain: cohort.chain, signer: cohort.signer, accounts: cohort.accounts.map(a => a.ss58) },
      `Would claim for ${cohort.accounts.length} account(s)`,
    );
  }

  logger.info(`Dry run complete: ${cohorts.length} cohort(s)`);
}

run().catch(error => {
  console.error('Payouts run failed:', error);
  process.exit(1);
});
