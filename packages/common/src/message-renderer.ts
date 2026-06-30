import { MessageContent, MessagePayload, NotificationType, Style } from './notification';

type Renderer = {
  banner: (icon: string, title: string) => string; // generic: icon + bold title
  heading: (icon: string, label: string, title: string, ack: boolean) => string; // labelled: icon + bold "label:" + title
  details: (items: string[]) => string; // items already link-formatted
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

export class MessageRenderer {
  // Incident messages: derives the icon and prefixes a bold incident id.
  static format(style: Style, payload: MessagePayload): string {
    const r = renderers[style];
    const linkFmt = (text: string) => this.formatLinks(text, r.link, r.escape);
    const title = r.formatNewlines(linkFmt(payload.title)).trim();
    const icon = this.iconFor(payload.kind, !!payload.needsAck, !!payload.isResolved);
    return r.heading(icon, payload.incidentId, title, !!payload.needsAck) + r.details((payload.details ?? []).map(linkFmt));
  }

  // Generic messages: caller supplies the icon and title directly.
  static render(style: Style, content: MessageContent): string {
    const r = renderers[style];
    const linkFmt = (text: string) => this.formatLinks(text, r.link, r.escape);
    const title = r.formatNewlines(linkFmt(content.title));
    return r.banner(content.icon, title) + r.details((content.details ?? []).map(linkFmt));
  }

  private static iconFor(kind: NotificationType, needsAck: boolean, isResolved: boolean): string {
    if (kind === NotificationType.Escalation) return '🚨';
    if (kind === NotificationType.Resolution) return '✅';
    return isResolved ? 'ℹ️' : '🔥';
  }

  private static formatLinks(text: string, link: (url: string, title: string) => string, escape: (s: string) => string): string {
    const safe = escape(text);
    const linkRegex = /\[((?:[^[\]]|\[(?:[^[\]]|\[(?:[^[\]]|\[[^[\]]*\])*\])*\])*)\]\(([^)]+)\)/g;
    return safe.replace(linkRegex, (_, title, url) => link(url, title));
  }
}
