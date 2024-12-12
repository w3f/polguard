import { Message } from '../interfaces';
import { MessageType, MessengerType } from '../constants';

type StyleType = 'html' | 'plain' | 'markdown';

interface Link {
  url: string;
  title: string;
}

export class MessageStyler {
  static applyStyle(message: Message, messageType: MessageType, messengerType: MessengerType): string {
    let styleType: StyleType = 'plain';

    switch (messengerType) {
      case MessengerType.Matrix:
        styleType = 'html';
        break;
      case MessengerType.Slack:
      case MessengerType.Telegram:
        styleType = 'markdown';
        break;
    }

    return this.styleMessage(message, messageType, styleType);
  }

  private static styleMessage(message: Message, messageType: MessageType, styleType: StyleType): string {
    const { prefix, color } = this.getPrefixAndColor(messageType);
    const title = this.styleTitle(prefix, message.title, color, styleType);
    const details = this.styleDetails(message.details, styleType);
    return `${title}\n${details}`;
  }

  private static styleTitle(prefix: string, title: string, color: string, styleType: StyleType): string {
    const linkedTitle = this.styleLinks(title, styleType);
    switch (styleType) {
      case 'html':
        return `<b><font color="${color}">${prefix}</font>${linkedTitle}</b>`;
      case 'markdown':
        return `**${prefix}${linkedTitle}**`;
      case 'plain':
      default:
        return `${prefix}${linkedTitle}`;
    }
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

  private static getPrefixAndColor(messageType: MessageType): { prefix: string; color: string } {
    switch (messageType) {
      case MessageType.Firing:
        return { prefix: 'FIRING: ', color: 'red' };
      case MessageType.Resolved:
        return { prefix: 'RESOLVED: ', color: 'green' };
      case MessageType.OneTime:
        return { prefix: 'EVENT: ', color: 'red' };
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
