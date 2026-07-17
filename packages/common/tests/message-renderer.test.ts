import { renderIncident, renderBanner, buildExplorerUrl, explorerLink } from '../src/message-renderer';
import { NotificationType, Style, IncidentView } from '../src/notification';
import { Chain } from '../src/constants';

describe('MessageRenderer', () => {
  const incidentId = 'GEB7BN648733';

  const createView = (
    condition: string,
    details: string[] = [],
    type: NotificationType = NotificationType.Alert,
    isResolved = true,
    needsAck = false,
    subject?: { name: string; address: string },
  ): IncidentView => {
    return { incidentId, type, chain: Chain.Polkadot, isResolved, needsAck, content: { subject, condition, details } };
  };

  describe('format(IncidentView)', () => {
    describe('Style Type Styling', () => {
      const view = createView('Test Message', ['Detail 1', 'Detail 2'], NotificationType.Alert, true, true);

      it('should style HTML messages correctly', () => {
        const result = renderIncident(Style.Html, view);
        expect(result).toContain('<ul>');
        expect(result).toContain('<li>Detail 1</li>');
        expect(result).toContain('<li>Detail 2</li>');
        expect(result).toContain('</ul>');
        expect(result).toContain('ℹ️');
      });

      it('should style Markdown messages correctly', () => {
        const result = renderIncident(Style.Markdown, view);
        expect(result).toContain(`**${incidentId}:**`);
        expect(result).toContain('- Detail 1');
        expect(result).toContain('- Detail 2');
        expect(result).toContain('ℹ️');
      });

      it('should style Plain text messages correctly', () => {
        const result = renderIncident(Style.Plain, view);
        expect(result).not.toContain('**');
        expect(result).toContain('Detail 1');
        expect(result).toContain('Detail 2');
        expect(result).toContain('ℹ️');
        expect(result).toContain(`${incidentId}:`);
      });
    });

    describe('Icon derivation from (type, isResolved)', () => {
      it('unresolved Alert -> 🔥', () => {
        const view = createView('Test Message', [], NotificationType.Alert, false, false);
        const result = renderIncident(Style.Html, view);
        expect(result).toContain('🔥');
      });

      it('resolved (one-time) Alert -> ℹ️', () => {
        const view = createView('Test Message', [], NotificationType.Alert, true, true);
        const result = renderIncident(Style.Html, view);
        expect(result).toContain('ℹ️');
      });

      it('Resolution -> ✅', () => {
        const view = createView('Test Message', [], NotificationType.Resolution);
        const result = renderIncident(Style.Html, view);
        expect(result).toContain('✅');
      });

      it('Escalation -> 🚨', () => {
        const view = createView('Test Message', [], NotificationType.Escalation);
        const result = renderIncident(Style.Html, view);
        expect(result).toContain('🚨');
      });
    });

    describe('Title grammar', () => {
      it('subjectless title is just the condition', () => {
        const view = createView('Referendum #12 submitted', [], NotificationType.Alert, true, false);
        const result = renderIncident(Style.Html, view);
        expect(result).toContain('Referendum #12 submitted');
      });

      it('subject renders as condition — subject with account link', () => {
        const view = createView('Balance below threshold', [], NotificationType.Alert, false, false, {
          name: 'Alice',
          address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        });
        const result = renderIncident(Style.Html, view);
        expect(result).toContain('Balance below threshold —');
        expect(result).toContain('Alice');
      });

      it('unnamed subject truncates the address as link text', () => {
        const view = createView('Sent 1.00 DOT', [], NotificationType.Alert, true, false, {
          name: undefined as unknown as string,
          address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        });
        const result = renderIncident(Style.Html, view);
        expect(result).toContain('5Grwva…GKutQY');
      });

      it('Resolution prefixes "Resolved:"', () => {
        const view = createView('Balance below threshold', [], NotificationType.Resolution, true, false, {
          name: 'Alice',
          address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        });
        const result = renderIncident(Style.Html, view);
        expect(result).toContain('Resolved: Balance below threshold —');
      });

      it('adds ack badge when needsAck is true', () => {
        const view = createView('Test Title', [], NotificationType.Alert, false, true);
        const result = renderIncident(Style.Html, view);
        expect(result).toContain('❗');
      });
    });

    describe('Link Styling', () => {
      it('should style simple links correctly', () => {
        const view = createView('[Simple Link](https://example.com)');
        const result = renderIncident(Style.Html, view);
        expect(result).toContain('<a href="https://example.com">Simple Link</a>');
      });

      it('should handle links with nested brackets', () => {
        const view = createView('[Staker Space [3]](https://polkadot.subscan.io/account/123)');
        const result = renderIncident(Style.Html, view);
        expect(result).toContain('<a href="https://polkadot.subscan.io/account/123">Staker Space [3]</a>');
      });

      it('should handle links in message details', () => {
        const view = createView('Title', [
          'Normal text',
          '[Simple Link](https://example.com)',
          '[Nested [Bracket] Link](https://test.com)',
        ]);
        const result = renderIncident(Style.Html, view);
        expect(result).toContain('<li>Normal text</li>');
        expect(result).toContain('<li><a href="https://example.com">Simple Link</a></li>');
        expect(result).toContain('<li><a href="https://test.com">Nested [Bracket] Link</a></li>');
      });

      it('should handle multiple links in single line', () => {
        const view = createView('Check [Link1](https://one.com) and [Link2 [2]](https://two.com)');
        const result = renderIncident(Style.Html, view);
        expect(result).toContain('<a href="https://one.com">Link1</a>');
        expect(result).toContain('<a href="https://two.com">Link2 [2]</a>');
      });
    });
  });

  describe('Footer (block context)', () => {
    const base = {
      incidentId,
      type: NotificationType.Alert,
      chain: Chain.Polkadot,
      isResolved: false,
      content: { condition: 'Test', details: ['Fact 1'] },
    };

    it('omits the footer when no blockNumber is present', () => {
      const result = renderIncident(Style.Html, base);
      expect(result).not.toContain('Block:');
      expect(result).not.toContain('Chain:');
    });

    it('renders a Block link + Chain line for state context (blockNumber only)', () => {
      const result = renderIncident(Style.Html, { ...base, blockNumber: 100 });
      expect(result).toContain('Block:');
      expect(result).toContain('/block/100');
      expect(result).toContain('Chain:');
    });

    it('renders an Event link when eventIdx is present', () => {
      const result = renderIncident(Style.Html, { ...base, blockNumber: 100, eventIdx: 5 });
      expect(result).toContain('Event:');
      expect(result).toContain('/event/100-5');
      expect(result).not.toContain('Block:');
    });

    it('renders an Extrinsic link when only extrinsicIdx is present', () => {
      const result = renderIncident(Style.Html, { ...base, blockNumber: 100, extrinsicIdx: 2 });
      expect(result).toContain('Extrinsic:');
      expect(result).toContain('/extrinsic/100-2');
    });

    it('keeps the handler facts alongside the footer', () => {
      const result = renderIncident(Style.Html, { ...base, blockNumber: 100 });
      expect(result).toContain('<li>Fact 1</li>');
    });
  });

  describe('account: scheme expansion', () => {
    const address = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

    it('resolves a named account marker to an explorer link with the given label', () => {
      const view = createView('Title', [`To: [Alice](account:${address})`]);
      const result = renderIncident(Style.Html, view);
      expect(result).toContain(`<a href="https://polkadot.subscan.io/account/${address}">Alice</a>`);
    });

    it('truncates the address label when the marker has no name', () => {
      const view = createView('Title', [`From: [${address}](account:${address})`]);
      const result = renderIncident(Style.Html, view);
      expect(result).toContain(`<a href="https://polkadot.subscan.io/account/${address}">5Grwva…GKutQY</a>`);
    });
  });

  describe('buildExplorerUrl', () => {
    it('uses the chain specName as the subscan subdomain, not the chain name', () => {
      // AssetHubPolkadot -> specName "statemint" (the chain name would be the invalid "assethubpolkadot")
      expect(buildExplorerUrl(Chain.AssetHubPolkadot, 'event', '100-5')).toBe(
        'https://statemint.subscan.io/event/100-5',
      );
      expect(buildExplorerUrl(Chain.AssetHubKusama, 'account', 'addr')).toBe(
        'https://statemine.subscan.io/account/addr',
      );
    });

    it('builds extrinsic and block urls for relay chains', () => {
      expect(buildExplorerUrl(Chain.Polkadot, 'extrinsic', '200-3')).toBe(
        'https://polkadot.subscan.io/extrinsic/200-3',
      );
      expect(buildExplorerUrl(Chain.Polkadot, 'block', 300)).toBe('https://polkadot.subscan.io/block/300');
    });

    it('uses statescan with the /#/ prefix and pluralized resources for Frequency', () => {
      expect(buildExplorerUrl(Chain.Frequency, 'event', '10-1')).toBe(
        'https://frequency.statescan.io/#/events/10-1',
      );
      expect(buildExplorerUrl(Chain.Frequency, 'account', 'addr')).toBe(
        'https://frequency.statescan.io/#/accounts/addr',
      );
    });
  });

  describe('explorerLink', () => {
    it('returns null when there is no block', () => {
      expect(explorerLink(Chain.Polkadot, {})).toBeNull();
    });

    it('prefers the event link, then extrinsic, then block', () => {
      expect(explorerLink(Chain.Polkadot, { blockNumber: 100, eventIdx: 5, extrinsicIdx: 2 }))
        .toMatchObject({ label: 'Event', identifier: '100-5' });
      expect(explorerLink(Chain.Polkadot, { blockNumber: 100, extrinsicIdx: 2 }))
        .toMatchObject({ label: 'Extrinsic', identifier: '100-2' });
      expect(explorerLink(Chain.Polkadot, { blockNumber: 100 }))
        .toMatchObject({ label: 'Block', identifier: '100' });
    });

    it('treats null indices the same as missing (DB rows carry null, not undefined)', () => {
      expect(explorerLink(Chain.Polkadot, { blockNumber: 100, eventIdx: null, extrinsicIdx: null }))
        .toMatchObject({ label: 'Block' });
    });
  });

  describe('render(Banner)', () => {
    it('renders icon and title', () => {
      const result = renderBanner(Style.Html, { icon: '✅', title: 'Test Title' });
      expect(result).toContain('✅');
      expect(result).toContain('Test Title');
      expect(result).not.toContain('<ul>');
    });

    it('renders details as a bullet list', () => {
      const result = renderBanner(Style.Html, { icon: '✅', title: 'Test Title', details: ['a', 'b'] });
      expect(result).toContain('<li>a</li>');
      expect(result).toContain('<li>b</li>');
    });
  });
});
