import { Message } from '../interfaces';
import { MessageType, MessengerType } from '../constants';

type StyleType = 'html' | 'plain' | 'markdown';

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
    switch (styleType) {
      case 'html':
        return `<b><font color="${color}">${prefix}</font>${title}</b>`;
      case 'markdown':
        return `**${prefix}${title}**`;
      case 'plain':
      default:
        return `${prefix}${title}`;
    }
  }

  private static styleDetails(details: string[], styleType: StyleType): string {
    const styledDetails = details.map(detail => this.styleLinks(detail, styleType));

    switch (styleType) {
      case 'html':
        return `<ul>${styledDetails.map(detail => `<li>${detail}</li>`).join('')}</ul>`;
      case 'markdown':
        return styledDetails.map(detail => `- ${detail}`).join('\n');
      case 'plain':
      default:
        return styledDetails.join('\n');
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
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    
    return text.replace(linkRegex, (url) => {
      const domain = new URL(url).hostname;
      switch (styleType) {
        case 'html':
          return `<a href="${url}">${domain}</a>`;
        case 'markdown':
          return `[${domain}](${url})`;
        case 'plain':
        default:
          return `${domain} (${url})`;
      }
    });
  }
}
