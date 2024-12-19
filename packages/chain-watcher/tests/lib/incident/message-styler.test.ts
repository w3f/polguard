import { MessageStyler } from '@lib/incident/message-styler';
import { Message, MessageType, MessengerType } from '@w3f/monitoring-types';

describe('MessageStyler', () => {
  const createMessage = (title: string, details: string[] = []): Message => ({
    title,
    details,
  });

  describe('Messenger Type Styling', () => {
    const message = createMessage('Test Message', ['Detail 1', 'Detail 2']);

    it('should style Matrix messages with HTML', () => {
      const result = MessageStyler.applyStyle(message, MessageType.OneTime, MessengerType.Matrix);
      expect(result).toContain('<b>');
      expect(result).toContain('</b>');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Detail 1</li>');
      expect(result).toContain('<li>Detail 2</li>');
      expect(result).toContain('</ul>');
    });

    it('should style Slack messages with Markdown', () => {
      const result = MessageStyler.applyStyle(message, MessageType.OneTime, MessengerType.Slack);
      expect(result).toContain('**');
      expect(result).toContain('- Detail 1');
      expect(result).toContain('- Detail 2');
    });

    it('should style Telegram messages with Markdown', () => {
      const result = MessageStyler.applyStyle(message, MessageType.OneTime, MessengerType.Telegram);
      expect(result).toContain('**');
      expect(result).toContain('- Detail 1');
      expect(result).toContain('- Detail 2');
    });
  });

  describe('Message Type Styling', () => {
    const message = createMessage('Test Message');

    it('should style FIRING messages correctly', () => {
      const result = MessageStyler.applyStyle(message, MessageType.Firing, MessengerType.Matrix);
      expect(result).toContain('<font color="red">FIRING: </font>');
    });

    it('should style RESOLVED messages correctly', () => {
      const result = MessageStyler.applyStyle(message, MessageType.Resolved, MessengerType.Matrix);
      expect(result).toContain('<font color="green">RESOLVED: </font>');
    });

    it('should style EVENT messages correctly', () => {
      const result = MessageStyler.applyStyle(message, MessageType.OneTime, MessengerType.Matrix);
      expect(result).toContain('<font color="red">EVENT: </font>');
    });
  });

  describe('Link Styling', () => {
    it('should style simple links correctly', () => {
      const message = createMessage(
        '[Simple Link](https://example.com)'
      );

      const htmlResult = MessageStyler.applyStyle(message, MessageType.OneTime, MessengerType.Matrix);
      const markdownResult = MessageStyler.applyStyle(message, MessageType.OneTime, MessengerType.Slack);
      const telegramResult = MessageStyler.applyStyle(message, MessageType.OneTime, MessengerType.Telegram);

      expect(htmlResult).toContain('<a href="https://example.com">Simple Link</a>');
      expect(markdownResult).toContain('[Simple Link](https://example.com)');
      expect(telegramResult).toContain('[Simple Link](https://example.com)');
    });

    it('should handle links with nested brackets', () => {
      const message = createMessage(
        '[Staker Space [3]](https://polkadot.subscan.io/account/123)'
      );

      const htmlResult = MessageStyler.applyStyle(message, MessageType.OneTime, MessengerType.Matrix);
      const markdownResult = MessageStyler.applyStyle(message, MessageType.OneTime, MessengerType.Slack);
      const telegramResult = MessageStyler.applyStyle(message, MessageType.OneTime, MessengerType.Telegram);

      expect(htmlResult).toContain('<a href="https://polkadot.subscan.io/account/123">Staker Space [3]</a>');
      expect(markdownResult).toContain('[Staker Space [3]](https://polkadot.subscan.io/account/123)');
      expect(telegramResult).toContain('[Staker Space [3]](https://polkadot.subscan.io/account/123)');
    });

    it('should transform markdown link to HTML', () => {
      const result = MessageStyler['styleLinks'](
        '[Complex [Nested [Brackets]] Test](https://example.com)', 
        'html'
      );
      
      expect(result).toBe('<a href="https://example.com">Complex [Nested [Brackets]] Test</a>');
    });

    it('should handle multiple nested brackets', () => {
      const message = createMessage(
        '[Complex [Nested [Brackets]] Test](https://example.com)'
      );

      const htmlResult = MessageStyler.applyStyle(message, MessageType.OneTime, MessengerType.Matrix);

      expect(htmlResult).toContain(
        '<a href="https://example.com">Complex [Nested [Brackets]] Test</a>'
      );
    });

    it('should handle links in message details', () => {
      const message = createMessage(
        'Title',
        [
          'Normal text',
          '[Simple Link](https://example.com)',
          '[Nested [Bracket] Link](https://test.com)',
        ]
      );

      const htmlResult = MessageStyler.applyStyle(message, MessageType.OneTime, MessengerType.Matrix);
      
      expect(htmlResult).toContain('<li>Normal text</li>');
      expect(htmlResult).toContain('<li><a href="https://example.com">Simple Link</a></li>');
      expect(htmlResult).toContain('<li><a href="https://test.com">Nested [Bracket] Link</a></li>');
    });

    it('should handle multiple links in single line', () => {
      const message = createMessage(
        'Check [Link1](https://one.com) and [Link2 [2]](https://two.com)'
      );

      const htmlResult = MessageStyler.applyStyle(message, MessageType.OneTime, MessengerType.Matrix);
      
      expect(htmlResult).toContain('<a href="https://one.com">Link1</a>');
      expect(htmlResult).toContain('<a href="https://two.com">Link2 [2]</a>');
    });
  });
});