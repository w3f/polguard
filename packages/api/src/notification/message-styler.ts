import { MessageType } from '@w3f/monitoring-types';

export type StyleType = 'html' | 'plain' | 'markdown';

interface Link {
  url: string;
  title: string;
}

export class MessageStyler {
  /**
   * Parses a message string into title and details, prepends an incident ID,
   * and applies styling based on the message type and style type.
   *
   * @param messageContent The raw message content to parse and style
   * @param messageType The type of message (Firing, Resolved, OneTime)
   * @param styleType The style to apply (html, plain, markdown)
   * @param incidentId Required incident ID to prepend to the title
   * @returns Styled message string
   */
  static parseAndStyle(
    messageContent: string,
    messageType: MessageType,
    styleType: StyleType,
    incidentId: string,
    needsAck?: boolean,
  ): string {
    const lines = messageContent.split('\n').filter(line => line.trim() !== '');
    const title = lines[0] || '';
    const details = lines.slice(1) || [];

    return this.applyStyle(title, details, messageType, styleType, incidentId, needsAck);
  }

  static applyStyle(
    title: string,
    details: string[],
    messageType: MessageType,
    styleType: StyleType,
    incidentId: string,
    needsAck?: boolean,
  ): string {
    const icon = this.getStatusIcon(messageType);
    const ackBadge = needsAck ? ' ❗' : '';

    let styledHeading: string;
    let styledDetails: string;

    if (styleType === 'html') {
      const styledTitle = this.styleLinks(title.trim(), styleType);
      styledHeading = `<p>${icon} <strong>${incidentId}:</strong> ${styledTitle}${ackBadge}</p>`;
      styledDetails = this.styleDetails(details, styleType);
    } else if (styleType === 'markdown') {
      styledHeading = `${icon} **${incidentId}:** ${title.trim()}${ackBadge}`;
      styledDetails = this.styleDetails(details, 'markdown');
    } else {
      styledHeading = `${icon} ${incidentId}: ${title.trim()}${ackBadge}`;
      styledDetails = this.styleDetails(details, 'plain');
    }

    return `${styledHeading}\n${styledDetails}`;
  }

  private static styleDetails(details: string[], styleType: StyleType): string {
    const linkedDetails = details.map(detail => this.styleLinks(detail, styleType));

    switch (styleType) {
      case 'html':
        return `<ul>${linkedDetails.map(detail => `<li>${detail}</li>`).join('')}</ul>`;
      case 'markdown':
        return linkedDetails.map(detail => `- ${detail}`).join('\n');
      case 'plain':
      default:
        return linkedDetails.join('\n');
    }
  }

  private static getStatusIcon(messageType: MessageType): string {
    switch (messageType) {
      case MessageType.Firing:
        return '🔥';
      case MessageType.Resolved:
        return '✅';
      case MessageType.OneTime:
        return 'ℹ️';
    }
  }

  private static styleLinks(text: string, styleType: StyleType): string {
    const linkRegex = /\[((?:[^\[\]]|\[(?:[^\[\]]|\[(?:[^\[\]]|\[[^\[\]]*\])*\])*\])*)\]\(([^)]+)\)/g;

    return text.replace(linkRegex, (_, title, url) => {
      return this.styleLink({ url, title }, styleType);
    });
  }

  private static styleLink(link: Link, styleType: StyleType): string {
    switch (styleType) {
      case 'html':
        return `<a href="${link.url}">${link.title}</a>`;
      case 'markdown':
        return `[${link.title}](${link.url})`;
      case 'plain':
      default:
        return `${link.title} (${link.url})`;
    }
  }
}
