import { AppLogger, PayoutAccount } from '@w3f/polguard-common';
import { loadSnapshot } from '../loader';

export async function getPayoutAccounts(dir: string, logger: AppLogger): Promise<PayoutAccount[]> {
  const snapshot = await loadSnapshot(dir, logger);
  const accounts = new Map<string, PayoutAccount>();

  for (const group of snapshot.groups) {
    const groupPayout = group.operations?.payout;
    if (!groupPayout) {
      continue;
    }

    for (const account of group.accounts) {
      const resolved = { ...groupPayout, ...account.operations?.payout };

      if (resolved.signer === undefined) {
        throw new Error(`Payout group "${group.id}" account "${account.name}" has no signer`);
      }

      const notifications = resolved.notifications ?? group.notifications;
      const key = `${group.chain}:${account.ss58}`;
      const existing = accounts.get(key);

      if (existing) {
        if (existing.signer !== resolved.signer) {
          logger.warn(
            `Conflicting signer for ${account.ss58} on ${group.chain}: keeping "${existing.signer}", ignoring "${resolved.signer}"`,
          );
        }
        continue;
      }

      accounts.set(key, {
        ss58: account.ss58,
        hex: account.hex,
        name: account.name,
        chain: group.chain,
        group: group.id,
        signer: resolved.signer,
        ...(notifications && { notifications }),
      });
    }
  }

  return [...accounts.values()];
}
