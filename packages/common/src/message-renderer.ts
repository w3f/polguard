import { Banner, IncidentView, NotificationType, Style } from './notification';
import { Chain, getChainProperties } from './constants';

export type ExplorerResource = 'event' | 'extrinsic' | 'block' | 'account';

// ── Public API ───────────────────────────────────────────────────────────────────────────────

export function renderIncident(style: Style, view: IncidentView): string {
  const { type, chain, isResolved, needsAck, incidentId, content } = view;
  const icon = iconFor(type, isResolved);
  const subject = content.subject ? accountLink(chain, content.subject.name, content.subject.address) : '';
  const headline = type === NotificationType.Resolution ? `Resolved: ${content.condition}` : content.condition;
  const title = subject ? `${headline} — ${subject}` : headline;
  const details = [...(content.details ?? []), ...footer(view)];
  return renderMessage(style, { icon, title, details, label: incidentId, ack: !!needsAck, chain });
}

export function renderBanner(style: Style, banner: Banner): string {
  return renderMessage(style, { icon: banner.icon, title: banner.title, details: banner.details });
}

export function buildExplorerUrl(chain: Chain, resource: ExplorerResource, identifier: string | number): string {
  const { specName } = getChainProperties(chain);
  const isStatescan = STATESCAN_CHAINS.includes(chain);
  const domain = isStatescan ? 'statescan.io' : 'subscan.io';
  const pathPrefix = isStatescan ? '/#/' : '/';
  const resourceName = isStatescan ? `${resource}s` : resource;
  return `https://${specName}.${domain}${pathPrefix}${resourceName}/${identifier}`;
}

export function explorerLink(
  chain: Chain,
  ref: { blockNumber?: number | null; eventIdx?: number | null; extrinsicIdx?: number | null },
): { label: string; identifier: string; url: string } | null {
  const { blockNumber, eventIdx, extrinsicIdx } = ref;
  if (blockNumber == null) return null;
  if (eventIdx != null) {
    const identifier = `${blockNumber}-${eventIdx}`;
    return { label: 'Event', identifier, url: buildExplorerUrl(chain, 'event', identifier) };
  }
  if (extrinsicIdx != null) {
    const identifier = `${blockNumber}-${extrinsicIdx}`;
    return { label: 'Extrinsic', identifier, url: buildExplorerUrl(chain, 'extrinsic', identifier) };
  }
  return { label: 'Block', identifier: `${blockNumber}`, url: buildExplorerUrl(chain, 'block', blockNumber) };
}

/** Chain-free account marker; `renderIncident` resolves it to a real link via the view's chain. */
export function accountRef(address: string, name?: string): string {
  return `[${name ?? address}](${ACCOUNT_SCHEME}${address})`;
}

// ── Rendering ──────────────────────────────────────────────────────────────────────────────

type RenderInput = {
  icon: string;
  title: string;
  details?: string[];
  label?: string;
  ack?: boolean;
  chain?: Chain;
};

function renderMessage(style: Style, input: RenderInput): string {
  const r = renderers[style];
  const linkFmt = (text: string) => formatLinks(text, r.link, r.escape, input.chain);
  const title = r.formatNewlines(linkFmt(input.title)).trim();
  const details = (input.details ?? []).map(linkFmt);
  const header =
    input.label != null ? r.heading(input.icon, input.label, title, !!input.ack) : r.banner(input.icon, title);
  return header + r.details(details);
}

function footer(view: IncidentView): string[] {
  const link = explorerLink(view.chain, view);
  if (!link) return [];
  return [`${link.label}: [${link.identifier}](${link.url})`, `Chain: ${getChainProperties(view.chain).displayName}`];
}

function iconFor(type: NotificationType, isResolved: boolean): string {
  if (type === NotificationType.Escalation) return '🚨';
  if (type === NotificationType.Resolution) return '✅';
  return isResolved ? 'ℹ️' : '🔥';
}

function formatLinks(
  text: string,
  link: (url: string, title: string) => string,
  escape: (s: string) => string,
  chain?: Chain,
): string {
  const safe = escape(text);
  const linkRegex = /\[((?:[^[\]]|\[(?:[^[\]]|\[(?:[^[\]]|\[[^[\]]*\])*\])*\])*)\]\(([^)]+)\)/g;
  return safe.replace(linkRegex, (_, title, url) => {
    // Account markers ([label](account:<addr>)) resolve to a real explorer link via the chain.
    if (chain !== undefined && url.startsWith(ACCOUNT_SCHEME)) {
      const address = url.slice(ACCOUNT_SCHEME.length);
      return link(accountUrl(chain, address), accountLabel(title, address));
    }
    return link(url, title);
  });
}

// ── Explorer link helpers ────────────────────────────────────────────────────────────────────

function accountUrl(chain: Chain, address: string): string {
  return buildExplorerUrl(chain, 'account', address);
}

function accountLabel(name: string | undefined, address: string): string {
  return name && name !== address ? name : truncateAddress(address);
}

function accountLink(chain: Chain, name: string | undefined, address: string): string {
  return `[${accountLabel(name, address)}](${accountUrl(chain, address)})`;
}

function truncateAddress(addr: string): string {
  return addr.length <= 14 ? addr : `${addr.slice(0, 6)}…${addr.slice(-6)}`;
}

// ── Style templates ────────────────────────────────────────────────────────────────────────

const STATESCAN_CHAINS: Chain[] = [Chain.Frequency];

// Chain side emits `[label](account:<addr>)`; the renderer resolves it (see `formatLinks`).
const ACCOUNT_SCHEME = 'account:';

type Renderer = {
  banner: (icon: string, title: string) => string;
  heading: (icon: string, label: string, title: string, ack: boolean) => string;
  details: (items: string[]) => string;
  link: (url: string, title: string) => string;
  formatNewlines: (text: string) => string;
  escape: (s: string) => string;
};

const renderers: Record<Style, Renderer> = {
  [Style.Html]: {
    banner: (icon, title) => `<p>${icon} <strong>${title}</strong></p>`,
    heading: (icon, label, title, ack) => `<p>${icon} <strong>${label}:</strong> ${title}${ack ? '❗' : ''}</p>`,
    details: items => (items.length ? `<ul>${items.map(d => `<li>${d}</li>`).join('')}</ul>` : ''),
    link: (url, title) => `<a href="${url}">${title}</a>`,
    formatNewlines: text => text.replace(/\n/g, '<br>'),
    escape: s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  },
  [Style.Markdown]: {
    banner: (icon, title) => `${icon} **${title}**`,
    heading: (icon, label, title, ack) => `${icon} **${label}:** ${title}${ack ? '❗' : ''}`,
    details: items => (items.length ? '\n' + items.map(d => `- ${d}`).join('\n') : ''),
    link: (url, title) => `[${title}](${url})`,
    formatNewlines: text => text,
    escape: s => s,
  },
  [Style.Plain]: {
    banner: (icon, title) => `${icon} ${title}`,
    heading: (icon, label, title, ack) => `${icon} ${label}: ${title}${ack ? '❗' : ''}`,
    details: items => (items.length ? '\n' + items.map(d => d).join('\n') : ''),
    link: (url, title) => `${title} (${url})`,
    formatNewlines: text => text,
    escape: s => s,
  },
};
