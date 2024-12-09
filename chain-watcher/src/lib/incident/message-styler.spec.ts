import { MessageStyler } from './message-styler';
import { Message } from '../interfaces';
import { MessageType, MessengerType } from '../constants';

describe('MessageStyler', () => {
  const testMessage: Message = {
    title: 'Test [title](https://example.com)',
    details: ['Detail 1', 'Detail with [link](https://test.com)', 'Regular detail'],
  };

  describe('applyStyle', () => {
    it('should apply HTML style for Matrix messenger', () => {
      const result = MessageStyler.applyStyle(testMessage, MessageType.Firing, MessengerType.Matrix);
      expect(result).toContain('<b><font color="red">FIRING: </font>Test <a href="https://example.com">title</a></b>');
      expect(result).toContain(
        '<ul><li>Detail 1</li><li>Detail with <a href="https://test.com">link</a></li><li>Regular detail</li></ul>',
      );
    });

    it('should apply Markdown style for Slack messenger', () => {
      const result = MessageStyler.applyStyle(testMessage, MessageType.Resolved, MessengerType.Slack);
      expect(result).toContain('**RESOLVED: Test [title](https://example.com)**');
      expect(result).toContain('- Detail 1\n- Detail with [link](https://test.com)\n- Regular detail');
    });

    it('should apply Markdown style for Telegram messenger', () => {
      const result = MessageStyler.applyStyle(testMessage, MessageType.OneTime, MessengerType.Telegram);
      expect(result).toContain('**EVENT: Test [title](https://example.com)**');
      expect(result).toContain('- Detail 1\n- Detail with [link](https://test.com)\n- Regular detail');
    });
  });

  describe('styleMessage', () => {
    it('should style message correctly for plain text', () => {
      const result = MessageStyler['styleMessage'](testMessage, MessageType.Firing, 'plain');
      expect(result).toBe(
        'FIRING: Test title (https://example.com)\nDetail 1\nDetail with link (https://test.com)\nRegular detail',
      );
    });
  });

  describe('styleTitle', () => {
    it('should style title correctly for HTML', () => {
      const result = MessageStyler['styleTitle']('PREFIX: ', 'Test [title](https://example.com)', 'blue', 'html');
      expect(result).toBe('<b><font color="blue">PREFIX: </font>Test <a href="https://example.com">title</a></b>');
    });
  });

  describe('styleDetails', () => {
    it('should style details correctly for Markdown', () => {
      const result = MessageStyler['styleDetails'](testMessage.details, 'markdown');
      expect(result).toBe('- Detail 1\n- Detail with [link](https://test.com)\n- Regular detail');
    });
  });

  describe('styleLinks', () => {
    it('should style links correctly for HTML', () => {
      const result = MessageStyler['styleLinks']('Text with [link](https://example.com)', 'html');
      expect(result).toBe('Text with <a href="https://example.com">link</a>');
    });

    it('should not modify text without links', () => {
      const result = MessageStyler['styleLinks']('Text without links', 'markdown');
      expect(result).toBe('Text without links');
    });
  });
});
