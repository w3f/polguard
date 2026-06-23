import { Chain, PayoutAccount } from '@w3f/polguard-common';
import type { ChainConnection } from './config.service';

export interface Cohort {
  chain: Chain;
  signer: string;
  accounts: PayoutAccount[];
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

export function buildPlan(accounts: PayoutAccount[], { chains, signers }: PlanInputs): Cohort[] {
  const cohorts: Cohort[] = [];

  for (const [chain, chainAccounts] of groupBy(accounts, a => a.chain)) {
    if (!chains[chain]) {
      throw new Error(`Chain ${chain} has ${chainAccounts.length} payout account(s) but no rpcUrl configured`);
    }

    for (const [signer, signerAccounts] of groupBy(chainAccounts, a => a.signer)) {
      if (!signers[signer]) {
        throw new Error(`Signer "${signer}" is referenced on ${chain} but has no secret configured`);
      }
      cohorts.push({ chain, signer, accounts: signerAccounts });
    }
  }

  return cohorts;
}
