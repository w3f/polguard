import type { AppLogger, PayoutAccount } from '@w3f/polguard-common';
import type { PolkadotSigner } from 'polkadot-api/signer';
import type { PayoutApi } from './papi';
import type { ClaimConfig } from './config';

export interface Claim {
  stash: string;
  name: string;
  era: number;
  page: number;
  txHash: string;
}

export function claimableEraRange(
  activeEra: number,
  historyDepth: number,
  gracePeriodEras: number,
): { lower: number; upper: number } {
  return {
    lower: Math.max(activeEra - historyDepth, 0),
    upper: activeEra - 1 - gracePeriodEras,
  };
}

export function unclaimedPages(pageCount: number, claimedPages: number[]): number[] {
  const claimed = new Set(claimedPages);
  const pages: number[] = [];
  for (let page = 0; page < pageCount; page++) {
    if (!claimed.has(page)) pages.push(page);
  }
  return pages;
}

export async function claimGroup(
  api: PayoutApi,
  at: string,
  accounts: PayoutAccount[],
  signer: PolkadotSigner,
  claim: ClaimConfig,
  logger: AppLogger,
): Promise<Claim[]> {
  const activeEra = await api.query.Staking.ActiveEra.getValue({ at });
  if (!activeEra) return [];

  const historyDepth = await api.constants.Staking.HistoryDepth();
  const { lower, upper } = claimableEraRange(activeEra.index, historyDepth, claim.gracePeriodEras ?? 0);

  const byStash = new Map(accounts.map(a => [a.ss58, a]));
  const eraCount = Math.max(upper - lower + 1, 0);
  logger.info(`Scanning eras ${lower}..${upper} (${eraCount}) for ${accounts.length} account(s)`);

  const pending: Omit<Claim, 'txHash'>[] = [];
  for (let era = lower; era <= upper; era++) {
    logger.debug(`Scanning era ${era} (${era - lower + 1}/${eraCount})`);

    const overviews = await api.query.Staking.ErasStakersOverview.getEntries(era, { at });
    const mine = overviews.filter(e => byStash.has(e.keyArgs[1]));
    if (mine.length === 0) continue;

    const claimedByStash = new Map(
      (await api.query.Staking.ClaimedRewards.getEntries(era, { at })).map(e => [e.keyArgs[1], e.value]),
    );

    for (const entry of mine) {
      const stash = entry.keyArgs[1];
      const account = byStash.get(stash)!;
      const claimed = claimedByStash.get(stash) ?? [];
      for (const page of unclaimedPages(entry.value.page_count, claimed)) {
        pending.push({ stash, name: account.name, era, page });
      }
    }
  }

  logger.info(`Discovered ${pending.length} unclaimed page(s) across ${accounts.length} account(s)`);

  // One page per tx: batch_all is atomic, so an over-sized batch claims nothing, and the safe
  // size is unknown ahead of time. Single calls always fit and give partial progress.
  const submitted: Claim[] = [];
  for (const page of pending) {
    const tx = api.tx.Staking.payout_stakers_by_page({
      validator_stash: page.stash,
      era: page.era,
      page: page.page,
    });
    const result = await tx.signAndSubmit(signer);
    if (!result.ok) {
      throw new Error(
        `payout failed for ${page.name} era ${page.era} page ${page.page} at ${result.txHash}: ` +
          JSON.stringify(result.dispatchError),
      );
    }
    logger.info(`Claimed ${page.name} era ${page.era} page ${page.page}: ${result.txHash}`);
    submitted.push({ ...page, txHash: result.txHash });
  }

  return submitted;
}
