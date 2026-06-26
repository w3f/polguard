import { Chain, type AppLogger, type PayoutAccount } from '@w3f/polguard-common';
import type { ChainConnection } from './config';

export interface Cohort {
  signer: string;
  accounts: PayoutAccount[];
}

export interface ChainPlan {
  chain: Chain;
  rpcUrl: string;
  cohorts: Cohort[];
}

export interface PlanInputs {
  chains: Partial<Record<Chain, ChainConnection>>;
  signers: Record<string, string>;
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  return map;
}

export function buildPlan(accounts: PayoutAccount[], { chains, signers }: PlanInputs, logger: AppLogger): ChainPlan[] {
  const plan: ChainPlan[] = [];

  for (const [chain, chainAccounts] of groupBy(accounts, a => a.chain)) {
    const conn = chains[chain];
    if (!conn) {
      logger.warn(`Chain ${chain} has ${chainAccounts.length} payout account(s) but it's not configured; skipping`);
      continue;
    }

    const cohorts: Cohort[] = [];
    for (const [signer, signerAccounts] of groupBy(chainAccounts, a => a.signer)) {
      if (!signers[signer]) {
        logger.warn(`Signer "${signer}" on ${chain} has ${signerAccounts.length} account(s) but it's not configured; skipping `);
        continue;
      }
      cohorts.push({ signer, accounts: signerAccounts });
    }

    if (cohorts.length > 0) plan.push({ chain, rpcUrl: conn.rpcUrl, cohorts });
  }

  return plan;
}
