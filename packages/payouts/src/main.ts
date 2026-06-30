import pino from 'pino';
import { getPayoutAccounts } from '@w3f/polguard-config';
import { loadConfig } from './config';
import { buildPlan } from './planner';
import { createChainClient, getPayoutApi, signerFromMnemonic } from './papi';
import { claimGroup } from './claim-engine';
import { reportClaims } from './reporter';

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
  for (const { chain, rpcUrl, groups } of plan) {
    const client = createChainClient(rpcUrl);
    try {
      const api = getPayoutApi(client, chain);
      for (const group of groups) {
        const groupLogger = logger.child({ chain, signer: group.signer });
        try {
          const signer = signerFromMnemonic(config.signers[group.signer]);
          const submitted = await claimGroup(api, group.accounts, signer, config.claim, groupLogger);
          groupLogger.info({ submitted: submitted.length }, 'Signer group complete');
          await reportClaims(config.notifications, chain, group.accounts, { ok: true, claims: submitted }, groupLogger);
        } catch (error) {
          anyFailure = true;
          groupLogger.error({ err: error }, 'Signer group failed');
          await reportClaims(config.notifications, chain, group.accounts, { ok: false, error }, groupLogger);
        }
      }
    } finally {
      client.destroy();
    }
  }

  const groupCount = plan.reduce((n, p) => n + p.groups.length, 0);
  logger.info(`Run complete: ${groupCount} signer group(s), failures: ${anyFailure}`);
  return anyFailure ? 1 : 0;
}

run()
  .then(code => process.exit(code))
  .catch(error => {
    console.error('Payouts run failed:', error);
    process.exit(1);
  });
