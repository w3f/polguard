import { Style } from '@w3f/polguard-common';
import { Alert, renderAlerts } from '../src/lib/alertmanager';

const firing: Alert = {
  status: 'firing',
  labels: {
    alertname: 'KubePodCrashLooping',
    severity: 'critical',
    namespace: 'monitoring',
    pod: 'loki-0',
    prometheus: 'monitoring/kube-prometheus',
  },
  annotations: {
    summary: 'Pod is crash looping.',
    description: 'Pod monitoring/loki-0 is restarting.',
    runbook_url: 'https://runbooks.example.org/KubePodCrashLooping',
  },
};

describe('renderAlerts', () => {
  it('renders a firing alert as a polguard banner', () => {
    expect(renderAlerts(Style.Plain, { status: 'firing', alerts: [firing] })).toBe(
      '🔥 KubePodCrashLooping (critical): Pod monitoring/loki-0 is restarting.\nnamespace=monitoring  pod=loki-0',
    );
  });

  it('renders a resolved alert with its labels only', () => {
    const resolved = { ...firing, status: 'resolved' as const };
    expect(renderAlerts(Style.Plain, { status: 'resolved', alerts: [resolved] })).toBe(
      '✅ Resolved: KubePodCrashLooping (critical)\nnamespace=monitoring  pod=loki-0',
    );
  });

  it('escapes HTML in values', () => {
    const alert: Alert = { status: 'firing', labels: { alertname: 'X' }, annotations: { description: '<b>bold</b>' } };
    expect(renderAlerts(Style.Html, { status: 'firing', alerts: [alert] })).toContain('&lt;b&gt;bold&lt;/b&gt;');
  });

  it('states how many alerts are not shown', () => {
    const big: Alert = {
      status: 'firing',
      labels: { alertname: 'X' },
      annotations: { description: 'x'.repeat(20_000) },
    };
    const message = renderAlerts(Style.Plain, { status: 'firing', alerts: [big, big, big], truncatedAlerts: 2 });
    expect(Buffer.byteLength(message)).toBeLessThan(30_000);
    expect(message).toContain('4 more alerts not shown');
  });
});
