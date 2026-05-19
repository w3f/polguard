import { MessagePayload, NotificationType, Style } from '@w3f/polguard-common';

type Renderer = {
  heading: (icon: string, id: string, title: string, ack: boolean, linkFmt: (s: string) => string) => string;
  details: (items: string[], linkFmt: (s: string) => string) => string;
  link: (url: string, title: string) => string;
  formatNewlines: (text: string) => string;
  escape?: (s: string) => string; // optional, for HTML
};

const renderers: Record<Style, Renderer> = {
  [Style.Html]: {
    heading: (icon, id, title, ack, fmt) =>
      `<p>${icon} <strong>${id}:</strong> ${fmt(title.trim())}${ack ? '❗' : ''}</p>`,
    details: (items, fmt) => (items.length ? `<ul>${items.map(d => `<li>${fmt(d)}</li>`).join('')}</ul>` : ''),
    link: (url, title) => `<a href="${url}">${title}</a>`,
    formatNewlines: (text: string) => text.replace(/\n/g, '<br>'),
    escape: s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'),
  },
  [Style.Markdown]: {
    heading: (icon, id, title, ack, fmt) => `${icon} **${id}:** ${fmt(title.trim())}${ack ? '❗' : ''}`,
    details: (items, fmt) => (items.length ? '\n' + items.map(d => `- ${fmt(d)}`).join('\n') : ''),
    formatNewlines: (text: string) => text,
    link: (url, title) => `[${title}](${url})`,
  },
  [Style.Plain]: {
    heading: (icon, id, title, ack, fmt) => `${icon} ${id}: ${fmt(title.trim())}${ack ? '❗' : ''}`,
    details: (items, fmt) => (items.length ? '\n' + items.map(d => fmt(d)).join('\n') : ''),
    formatNewlines: (text: string) => text,
    link: (url, title) => `${title} (${url})`,
  },
};

export class MessageRenderer {
  static format(style: Style, payload: MessagePayload): string {
    const { title, details, kind, incidentId, needsAck, isResolved } = payload;
    const r = renderers[style];

    const linkFmt = (text: string) => this.formatLinks(text, (u, t) => r.link(u, t), r.escape);
    const formattedTitle = r.formatNewlines(linkFmt(title));
    const icon = this.iconFor(kind, !!needsAck, !!isResolved);

    return [
      r.heading(icon, incidentId, formattedTitle, !!needsAck, text => text), // Already formatted
      r.details(details ?? [], linkFmt),
    ].join('');
  }

  private static iconFor(kind: NotificationType, needsAck: boolean, isResolved: boolean): string {
    if (kind === NotificationType.Escalation) return '🚨';
    if (kind === NotificationType.Resolution) return '✅';
    return isResolved ? 'ℹ️' : '🔥';
  }

  private static formatLinks(
    text: string,
    link: (url: string, title: string) => string,
    escape?: (s: string) => string,
  ): string {
    const safe = escape ? escape(text) : text;
    const linkRegex = /\[((?:[^[\]]|\[(?:[^[\]]|\[(?:[^[\]]|\[[^[\]]*\])*\])*\])*)\]\(([^)]+)\)/g;
    return safe.replace(linkRegex, (_, title, url) => link(url, title));
  }
}
