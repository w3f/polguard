import { MessagePayload, MessageType, Style } from '@w3f/monitoring-types';

type Renderer = {
  heading: (icon: string, id: string, title: string, ack: boolean, linkFmt: (s: string) => string) => string;
  details: (items: string[], linkFmt: (s: string) => string) => string;
  preTitle: (pre?: string, linkFmt?: (s: string) => string) => string;
  link: (url: string, title: string) => string;
  escape?: (s: string) => string; // optional, for HTML
};

const renderers: Record<Style, Renderer> = {
  [Style.Html]: {
    heading: (icon, id, title, ack, fmt) =>
      `<p>${icon} <strong>${id}:</strong> ${fmt(title.trim())}${ack ? ' ❗' : ''}</p>`,
    details: (items, fmt) => (items.length ? `<ul>${items.map(d => `<li>${fmt(d)}</li>`).join('')}</ul>` : ''),
    preTitle: (pre, fmt) => (pre ? `<p>${fmt!(pre)}</p>` : ''),
    link: (url, title) => `<a href="${url}">${title}</a>`,
    escape: s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  },
  [Style.Markdown]: {
    heading: (icon, id, title, ack) => `${icon} **${id}:** ${title.trim()}${ack ? ' ❗' : ''}`,
    details: (items, fmt) => (items.length ? '\n' + items.map(d => `- ${fmt(d)}`).join('\n') : ''),
    preTitle: (pre, fmt) => (pre ? fmt!(pre) + '\n' : ''),
    link: (url, title) => `[${title}](${url})`,
  },
  [Style.Plain]: {
    heading: (icon, id, title, ack) => `${icon} ${id}: ${title.trim()}${ack ? ' ❗' : ''}`,
    details: (items, fmt) => (items.length ? '\n' + items.map(d => fmt(d)).join('\n') : ''),
    preTitle: (pre, fmt) => (pre ? fmt!(pre) + '\n' : ''),
    link: (url, title) => `${title} (${url})`,
  },
};

export class MessageRenderer {
  static format(style: Style, payload: MessagePayload): string {
    const { title, preTitle, details, messageType, incidentId, needsAck } = payload;
    const r = renderers[style];

    const linkFmt = (text: string) => this.formatLinks(text, (u, t) => r.link(u, t), r.escape);
    const icon = this.iconForType(messageType);

    return [
      r.preTitle(preTitle, linkFmt),
      r.heading(icon, incidentId, title, !!needsAck, linkFmt),
      r.details(details ?? [], linkFmt),
    ].join('');
  }

  private static iconForType(t: MessageType): string {
    switch (t) {
      case MessageType.Firing:
        return '🔥';
      case MessageType.Resolved:
        return '✅';
      case MessageType.Escalation:
        return '🚨';
      case MessageType.OneTime:
        return 'ℹ️';
    }
  }

  private static formatLinks(
    text: string,
    link: (url: string, title: string) => string,
    escape?: (s: string) => string,
  ): string {
    const safe = escape ? escape(text) : text;
    const linkRegex = /\[((?:[^\[\]]|\[(?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*\])*)\]\(([^)]+)\)/g;
    return safe.replace(linkRegex, (_, title, url) => link(url, title));
  }
}
