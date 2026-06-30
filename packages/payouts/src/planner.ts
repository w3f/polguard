import { Chain, type AppLogger, type PayoutAccount } from '@w3f/polguard-common';
import type { ChainConnection } from './config';

export interface SignerGroup {
  signer: string;
  accounts: PayoutAccount[];
}

export interface ChainPlan {
  chain: Chain;
  rpcUrl: string;
  groups: SignerGroup[];
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
      logger.warn(`Chain ${chain} has ${chainAccounts.length} payout account(s) but no rpcUrl configured; skipping`);
      continue;
    }

    const groups: SignerGroup[] = [];
    for (const [signer, signerAccounts] of groupBy(chainAccounts, a => a.signer)) {
      if (!signers[signer]) {
        logger.warn(`Signer "${signer}" on ${chain} has ${signerAccounts.length} account(s) but no secret configured; skipping`);
        continue;
      }
      groups.push({ signer, accounts: signerAccounts });
    }

    if (groups.length > 0) plan.push({ chain, rpcUrl: conn.rpcUrl, groups });
  }

  return plan;
}
