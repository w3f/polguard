import type { AppLogger, PayoutAccount } from '@w3f/polguard-common';
import type { PolkadotSigner } from 'polkadot-api/signer';
import type { TxBestBlocksState, TxEvent, TxFinalized, TxInBestBlocksFound } from 'polkadot-api';
import { filter, firstValueFrom } from 'rxjs';
import type { PayoutApi } from './papi';
import type { ClaimConfig } from './config';

export interface Claim {
  stash: string;
  name: string;
  era: number;
  page: number;
  txHash: string;
}

const isInBlock = (event: TxEvent): event is (TxBestBlocksState & TxInBestBlocksFound) | TxFinalized =>
  (event.type === 'txBestBlocksState' && event.found) || event.type === 'finalized';

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

  if (pending.length === 0) {
    logger.info(`No unclaimed pages across ${accounts.length} account(s)`);
    return [];
  }

  const pagesByGroup = new Map<string, number>();
  for (const page of pending) {
    const { group } = byStash.get(page.stash)!;
    pagesByGroup.set(group, (pagesByGroup.get(group) ?? 0) + 1);
  }
  const breakdown = [...pagesByGroup].map(([group, count]) => `${group} (${count})`).join(', ');
  logger.info(`Discovered ${pending.length} unclaimed page(s) across ${accounts.length} account(s): ${breakdown}`);

  // One page per tx: batch_all is atomic, so an over-sized batch claims nothing, and the safe
  // size is unknown ahead of time. Single calls always fit and give partial progress.
  const submitted: Claim[] = [];
  const failures: string[] = [];
  for (const page of pending) {
    const label = `${page.name} era ${page.era} page ${page.page}`;
    const tx = api.tx.Staking.payout_stakers_by_page({
      validator_stash: page.stash,
      era: page.era,
      page: page.page,
    });
    const result = await firstValueFrom(tx.signSubmitAndWatch(signer).pipe(filter(isInBlock)));
    if (!result.ok) {
      logger.error(`Payout rejected for ${label} at ${result.txHash}: ${JSON.stringify(result.dispatchError)}`);
      failures.push(label);
      continue;
    }
    logger.info(`Claimed ${label}: ${result.txHash}`);
    submitted.push({ ...page, txHash: result.txHash });
  }

  if (failures.length > 0) {
    const shown = failures.slice(0, 3).join('; ');
    throw new Error(`${failures.length} payout(s) rejected: ${shown}${failures.length > 3 ? '; …' : ''}`);
  }

  return submitted;
}
