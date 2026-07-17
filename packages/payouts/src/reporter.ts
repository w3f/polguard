import {
  MESSENGER_STYLE_MAP,
  buildExplorerUrl,
  renderBanner,
  MessengerType,
  sendNotification,
  type AppLogger,
  type Chain,
  type Banner,
  type PayoutAccount,
} from '@w3f/polguard-common';
import type { Claim } from './claim-engine';
import type { NotificationsConfig } from './config';

export interface ClaimOutcome {
  ok: boolean;
  claims?: Claim[];
  error?: unknown;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function accountLine(chain: Chain, account: PayoutAccount, claims: Claim[]): string {
  const mine = claims.filter(c => c.stash === account.ss58);
  if (mine.length === 0) return `${account.name}: nothing to claim`;
  const links = mine.map(c => `[era ${c.era} p${c.page}](${buildExplorerUrl(chain, 'extrinsic', c.txHash)})`);
  return `${account.name}: claimed ${mine.length} page(s) — ${links.join(', ')}`;
}

function buildContent(chain: Chain, accounts: PayoutAccount[], outcome: ClaimOutcome): Banner {
  if (!outcome.ok) {
    return {
      icon: '❌',
      title: `${chain} — payout run failed`,
      details: [`Accounts: ${accounts.map(a => a.name).join(', ')}`, `Error: ${errorMessage(outcome.error)}`],
    };
  }
  return {
    icon: '✅',
    title: `${chain} — payout run complete`,
    details: accounts.map(a => accountLine(chain, a, outcome.claims ?? [])),
  };
}

function urlFor(notifications: NotificationsConfig, messengerType: MessengerType): string | undefined {
  return messengerType === MessengerType.Matrix ? notifications.matrix?.url : undefined;
}

// Route each account to its resolved messenger channel(s), so each channel only sees its own
// accounts. A messenger type with no configured URL is skipped (stdout reporting stays the default).
export async function reportClaims(
  notifications: NotificationsConfig,
  chain: Chain,
  accounts: PayoutAccount[],
  outcome: ClaimOutcome,
  logger: AppLogger,
): Promise<void> {
  const routes = new Map<MessengerType, Map<string, PayoutAccount[]>>();
  for (const account of accounts) {
    const settings = account.notifications;
    if (!settings) continue;
    const channels = routes.get(settings.messengerType) ?? new Map<string, PayoutAccount[]>();
    for (const channelId of settings.channels) {
      const bucket = channels.get(channelId) ?? [];
      bucket.push(account);
      channels.set(channelId, bucket);
    }
    routes.set(settings.messengerType, channels);
  }

  for (const [messengerType, channels] of routes) {
    const url = urlFor(notifications, messengerType);
    if (!url) continue;
    const style = MESSENGER_STYLE_MAP[messengerType];
    for (const [channelId, channelAccounts] of channels) {
      const message = renderBanner(style, buildContent(chain, channelAccounts, outcome));
      if (await sendNotification(messengerType, url, channelId, message, logger)) {
        logger.info(`Reported to ${channelId}`);
      }
    }
  }
}
