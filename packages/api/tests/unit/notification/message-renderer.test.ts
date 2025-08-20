import { MessageRenderer } from '../../../src/notification/message-renderer';
import { NotificationType, Style, MessagePayload } from '@w3f/monitoring-types';

describe('MessageRenderer', () => {
  const incidentId = 'GEB7BN648733';

  const createMessageParts = (
    title: string,
    details: string[] = [],
    kind: NotificationType = NotificationType.Alert,
    isResolved = true,
    needsAck = false,
  ): MessagePayload => {
    return { title, details, kind, incidentId, isResolved, needsAck };
  };

  describe('Style Type Styling', () => {
    const parts = createMessageParts('Test Message', ['Detail 1', 'Detail 2'], NotificationType.Alert, true, true);

    it('should style HTML messages correctly', () => {
      const result = MessageRenderer.format(Style.Html, parts);
      expect(result).toContain('<ul>');
      expect(result).toContain('<li>Detail 1</li>');
      expect(result).toContain('<li>Detail 2</li>');
      expect(result).toContain('</ul>');
      expect(result).toContain('ℹ️');
    });

    it('should style Markdown messages correctly', () => {
      const result = MessageRenderer.format(Style.Markdown, parts);
      expect(result).toContain(`**${incidentId}:**`);
      expect(result).toContain('- Detail 1');
      expect(result).toContain('- Detail 2');
      expect(result).toContain('ℹ️');
    });

    it('should style Plain text messages correctly', () => {
      const result = MessageRenderer.format(Style.Plain, parts);
      expect(result).not.toContain('**');
      expect(result).toContain('Detail 1');
      expect(result).toContain('Detail 2');
      expect(result).toContain('ℹ️');
      expect(result).toContain(`${incidentId}:`);
    });
  });

  describe('Message Type Styling', () => {
    it('should style unresolved Alert messages correctly', () => {
      const parts = createMessageParts('Test Message', [], NotificationType.Alert, false, false);
      const result = MessageRenderer.format(Style.Html, parts);
      expect(result).toContain('🔥');
    });

    it('should style resolved Alert messages correctly', () => {
      const parts = createMessageParts('Test Message', [], NotificationType.Alert, true, true);
      const result = MessageRenderer.format(Style.Html, parts);
      expect(result).toContain('ℹ️');
    });

    it('should style Resolution messages correctly', () => {
      const parts = createMessageParts('Test Message', [], NotificationType.Resolution);
      const result = MessageRenderer.format(Style.Html, parts);
      expect(result).toContain('✅');
    });

    it('should style Escalation messages correctly', () => {
      const parts = createMessageParts('Test Message', [], NotificationType.Escalation);
      const result = MessageRenderer.format(Style.Html, parts);
      expect(result).toContain('🚨');
    });
  });

  describe('Message Composition', () => {
    it('should handle empty details', () => {
      const parts = createMessageParts('Test Title', [], NotificationType.Alert, true, true);
      const result = MessageRenderer.format(Style.Html, parts);
      expect(result).toContain('ℹ️');
      expect(result).toContain('Test Title');
      expect(result).not.toContain('<ul>');
    });

    it('should add ack badge when needsAck is true', () => {
      const parts = createMessageParts('Test Title', [], NotificationType.Alert, false, true);
      const result = MessageRenderer.format(Style.Html, parts);
      expect(result).toContain('❗');
    });
  });

  describe('Link Styling', () => {
    it('should style simple links correctly', () => {
      const parts = createMessageParts('[Simple Link](https://example.com)');
      const result = MessageRenderer.format(Style.Html, parts);
      expect(result).toContain('<a href="https://example.com">Simple Link</a>');
    });

    it('should handle links with nested brackets', () => {
      const parts = createMessageParts('[Staker Space [3]](https://polkadot.subscan.io/account/123)');
      const result = MessageRenderer.format(Style.Html, parts);
      expect(result).toContain('<a href="https://polkadot.subscan.io/account/123">Staker Space [3]</a>');
    });

    it('should handle links in message details', () => {
      const parts = createMessageParts('Title', [
        'Normal text',
        '[Simple Link](https://example.com)',
        '[Nested [Bracket] Link](https://test.com)',
      ]);
      const result = MessageRenderer.format(Style.Html, parts);
      expect(result).toContain('<li>Normal text</li>');
      expect(result).toContain('<li><a href="https://example.com">Simple Link</a></li>');
      expect(result).toContain('<li><a href="https://test.com">Nested [Bracket] Link</a></li>');
    });

    it('should handle multiple links in single line', () => {
      const parts = createMessageParts('Check [Link1](https://one.com) and [Link2 [2]](https://two.com)');
      const result = MessageRenderer.format(Style.Html, parts);
      expect(result).toContain('<a href="https://one.com">Link1</a>');
      expect(result).toContain('<a href="https://two.com">Link2 [2]</a>');
    });
  });
});
