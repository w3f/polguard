import assert from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import pino from 'pino';
import yaml from 'js-yaml';
import { getPayoutAccounts } from '@w3f/polguard-config';
import { Chain } from '@w3f/polguard-common';
import { loadConfig } from '../../src/config';
import { buildPlan } from '../../src/planner';
import { createChainClient, getPayoutApi, signerFromMnemonic, type PayoutApi } from '../../src/papi';
import { claimCohort, claimableEraRange, unclaimedPages } from '../../src/claim-engine';

const RPC_URL = 'wss://rpc-asset-hub-polkadot.luckyfriday.io';
const CHAIN = Chain.AssetHubPolkadot;
const SEED = process.env.PAYOUTS_TEST_SEED;
const SIGNER = 'integration';
// Claim everything up to activeEra-1 so the test actually triggers transactions.
const GRACE_PERIOD_ERAS = 0;
const WANTED_VALIDATORS = 2;
const MAX_VALIDATORS_TO_PROBE = 80;

const logger = pino({ transport: { target: 'pino-pretty', options: { colorize: true } } });

async function findValidatorsWithUnclaimedPages(api: PayoutApi): Promise<string[]> {
  const activeEra = await api.query.Staking.ActiveEra.getValue();
  assert(activeEra, 'no active era on chain');
  const historyDepth = await api.constants.Staking.HistoryDepth();
  const { lower, upper } = claimableEraRange(activeEra.index, historyDepth, GRACE_PERIOD_ERAS);

  const found = new Set<string>();
  let probed = 0;
  for (let era = upper; era >= lower && found.size < WANTED_VALIDATORS; era--) {
    const overviews = await api.query.Staking.ErasStakersOverview.getEntries(era);
    for (const { keyArgs, value } of overviews) {
      if (found.size >= WANTED_VALIDATORS || probed >= MAX_VALIDATORS_TO_PROBE) break;
      const stash = keyArgs[1];
      probed++;
      const claimed = await api.query.Staking.ClaimedRewards.getValue(era, stash);
      if (unclaimedPages(value.page_count, claimed).length > 0) {
        found.add(stash);
        logger.info(`Found validator with unclaimed pages in era ${era}: ${stash}`);
      }
    }
  }
  return [...found];
}

function writeConfigFixtures(stashes: string[]): { dir: string; configPath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'payouts-it-'));
  const configsDir = path.join(dir, 'configs');
  fs.mkdirSync(configsDir);

  const accounts = {
    groups: [
      { id: 'integration-group', chains: [CHAIN], operations: { payout: { signer: SIGNER } }, accountSet: 'integration-accounts' },
    ],
    accountSets: {
      'integration-accounts': stashes.map((address, i) => ({ address, name: `IT-${i}` })),
    },
  };
  fs.writeFileSync(path.join(configsDir, 'payouts.yaml'), yaml.dump(accounts));

  const config = {
    environment: 'test',
    logging: { level: 'info' },
    payoutConfigsDir: configsDir,
    chains: { [CHAIN]: { rpcUrl: RPC_URL } },
    signers: { [SIGNER]: SEED },
    claim: { gracePeriodEras: GRACE_PERIOD_ERAS },
  };
  const configPath = path.join(dir, 'config.yaml');
  fs.writeFileSync(configPath, yaml.dump(config));

  return { dir, configPath };
}

async function main(): Promise<void> {
  if (!SEED) {
    logger.warn('PAYOUTS_TEST_SEED is not set; skipping integration test');
    return;
  }

  // Discover claimable validators on chain.
  const discoveryClient = createChainClient(RPC_URL);
  let stashes: string[];
  try {
    stashes = await findValidatorsWithUnclaimedPages(getPayoutApi(discoveryClient, CHAIN));
  } finally {
    discoveryClient.destroy();
  }
  assert(stashes.length > 0, 'no validators with unclaimed pages found in the claimable window');

  // Generate config files and drive the real pipeline: config parsing -> resolver -> planner -> claim.
  const { dir, configPath } = writeConfigFixtures(stashes);
  try {
    const config = loadConfig(logger, configPath);
    const accounts = await getPayoutAccounts(config.payoutConfigsDir, logger);
    assert.strictEqual(accounts.length, stashes.length, `expected ${stashes.length} resolved account(s)`);

    const plan = buildPlan(accounts, { chains: config.chains, signers: config.signers }, logger);
    assert.strictEqual(plan.length, 1, 'expected one chain in the plan');
    assert.strictEqual(plan[0].cohorts.length, 1, 'expected one cohort');

    const { chain, rpcUrl, cohorts } = plan[0];
    const client = createChainClient(rpcUrl);
    try {
      const api = getPayoutApi(client, chain);
      const signer = signerFromMnemonic(config.signers[cohorts[0].signer]);

      const first = await claimCohort(api, cohorts[0].accounts, signer, config.claim, logger);
      assert(first.length > 0, 'expected at least one claim to be submitted');
      logger.info({ submitted: first }, 'First run submitted claims');

      const second = await claimCohort(api, cohorts[0].accounts, signer, config.claim, logger);
      assert.strictEqual(second.length, 0, 'second run should be idempotent (nothing to claim)');
      logger.info('Idempotent re-run found nothing to claim');
    } finally {
      client.destroy();
    }

    logger.info('Integration test passed');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

main().catch(error => {
  logger.error({ err: error }, 'Integration test failed');
  process.exit(1);
});
