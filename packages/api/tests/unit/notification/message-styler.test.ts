import { MessageStyler, Message } from '../../../src/notification/message-styler';
import { MessageType } from '@w3f/monitoring-types';

describe('MessageStyler', () => {
  const createMessage = (title: string, details: string[] = []): Message => ({
    title,
    details,
  });

  describe('Style Type Styling', () => {
    const message = createMessage('Test Message', ['Detail 1', 'Detail 2']);

    it('should style HTML messages correctly', () => {
      const result = MessageStyler.applyStyle(message, MessageType.OneTime, 'html');
      expect(result).toContain('<b>');
      expect(result).toContain('</b>');
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Detail 1</li>');
      expect(result).toContain('<li>Detail 2</li>');
      expect(result).toContain('</ul>');
    });

    it('should style Markdown messages correctly', () => {
      const result = MessageStyler.applyStyle(message, MessageType.OneTime, 'markdown');
      expect(result).toContain('**');
      expect(result).toContain('- Detail 1');
      expect(result).toContain('- Detail 2');
    });

    it('should style Plain text messages correctly', () => {
      const result = MessageStyler.applyStyle(message, MessageType.OneTime, 'plain');
      expect(result).not.toContain('**');
      expect(result).not.toContain('<b>');
      expect(result).toContain('Detail 1');
      expect(result).toContain('Detail 2');
    });
  });

  describe('Message Type Styling', () => {
    const message = createMessage('Test Message');

    it('should style FIRING messages correctly', () => {
      const result = MessageStyler.applyStyle(message, MessageType.Firing, 'html');
      expect(result).toContain('<font color="red">FIRING: </font>');
    });

    it('should style RESOLVED messages correctly', () => {
      const result = MessageStyler.applyStyle(message, MessageType.Resolved, 'html');
      expect(result).toContain('<font color="green">RESOLVED: </font>');
    });

    it('should style EVENT messages correctly', () => {
      const result = MessageStyler.applyStyle(message, MessageType.OneTime, 'html');
      expect(result).toContain('<font color="red">EVENT: </font>');
    });
  });

  describe('Parse and Style', () => {
    it('should parse and style a message correctly', () => {
      const messageContent = 'Test Title\nDetail 1\nDetail 2';
      const result = MessageStyler.parseAndStyle(messageContent, MessageType.OneTime, 'html');
      
      expect(result).toContain('<b><font color="red">EVENT: </font>Test Title</b>');
      expect(result).toContain('<li>Detail 1</li>');
      expect(result).toContain('<li>Detail 2</li>');
    });
    
    it('should prepend incident ID to title when provided', () => {
      const messageContent = 'Test Title\nDetail 1';
      const result = MessageStyler.parseAndStyle(messageContent, MessageType.Firing, 'html', 123);
      
      expect(result).toContain('<b><font color="red">FIRING: </font>123. Test Title</b>');
    });
    
    it('should handle empty message content', () => {
      const messageContent = '';
      const result = MessageStyler.parseAndStyle(messageContent, MessageType.Resolved, 'html', 456);
      
      expect(result).toContain('<b><font color="green">RESOLVED: </font>456. </b>');
    });
    
    it('should handle message with only title (no details)', () => {
      const messageContent = 'Just a title';
      const result = MessageStyler.parseAndStyle(messageContent, MessageType.OneTime, 'markdown', 789);
      
      expect(result).toContain('**EVENT: 789. Just a title**');
      expect(result).not.toContain('-'); // No details, so no list items
    });
  });

  describe('Link Styling', () => {
    it('should style simple links correctly', () => {
      const message = createMessage(
        '[Simple Link](https://example.com)'
      );

      const htmlResult = MessageStyler.applyStyle(message, MessageType.OneTime, 'html');
      const markdownResult = MessageStyler.applyStyle(message, MessageType.OneTime, 'markdown');
      const plainResult = MessageStyler.applyStyle(message, MessageType.OneTime, 'plain');

      expect(htmlResult).toContain('<a href="https://example.com">Simple Link</a>');
      expect(markdownResult).toContain('[Simple Link](https://example.com)');
      expect(plainResult).toContain('Simple Link (https://example.com)');
    });

    it('should handle links with nested brackets', () => {
      const message = createMessage(
        '[Staker Space [3]](https://polkadot.subscan.io/account/123)'
      );

      const htmlResult = MessageStyler.applyStyle(message, MessageType.OneTime, 'html');
      const markdownResult = MessageStyler.applyStyle(message, MessageType.OneTime, 'markdown');
      const plainResult = MessageStyler.applyStyle(message, MessageType.OneTime, 'plain');

      expect(htmlResult).toContain('<a href="https://polkadot.subscan.io/account/123">Staker Space [3]</a>');
      expect(markdownResult).toContain('[Staker Space [3]](https://polkadot.subscan.io/account/123)');
      expect(plainResult).toContain('Staker Space [3] (https://polkadot.subscan.io/account/123)');
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

      const htmlResult = MessageStyler.applyStyle(message, MessageType.OneTime, 'html');

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

      const htmlResult = MessageStyler.applyStyle(message, MessageType.OneTime, 'html');
      
      expect(htmlResult).toContain('<li>Normal text</li>');
      expect(htmlResult).toContain('<li><a href="https://example.com">Simple Link</a></li>');
      expect(htmlResult).toContain('<li><a href="https://test.com">Nested [Bracket] Link</a></li>');
    });

    it('should handle multiple links in single line', () => {
      const message = createMessage(
        'Check [Link1](https://one.com) and [Link2 [2]](https://two.com)'
      );

      const htmlResult = MessageStyler.applyStyle(message, MessageType.OneTime, 'html');
      
      expect(htmlResult).toContain('<a href="https://one.com">Link1</a>');
      expect(htmlResult).toContain('<a href="https://two.com">Link2 [2]</a>');
    });
  });
});
