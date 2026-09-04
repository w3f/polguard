import { Banner, renderBanner, Style } from '@w3f/polguard-common';

type Labels = Record<string, string>;

export interface Alert {
  status: 'firing' | 'resolved';
  labels: Labels;
  annotations?: Labels;
}

export interface AlertmanagerPayload {
  status: 'firing' | 'resolved';
  alerts: Alert[];
  truncatedAlerts?: number;
}

const labelsSchema = { type: 'object', additionalProperties: { type: 'string' } };

export const alertmanagerSchema = {
  type: 'object',
  required: ['status', 'alerts'],
  properties: {
    status: { enum: ['firing', 'resolved'] },
    truncatedAlerts: { type: 'integer', minimum: 0 },
    alerts: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['status', 'labels'],
        properties: {
          status: { enum: ['firing', 'resolved'] },
          labels: labelsSchema,
          annotations: labelsSchema,
        },
      },
    },
  },
};

const HIDDEN_LABELS = new Set([
  'alertname',
  'severity',
  'prometheus',
  'endpoint',
  'instance',
  'job',
  'service',
  'container',
]);
const MAX_BYTES = 30_000;

export function renderAlerts(style: Style, payload: AlertmanagerPayload): string {
  const banners = payload.alerts.map(alert => renderBanner(style, bannerFor(alert)));
  let omitted = payload.truncatedAlerts ?? 0;

  const compose = () => {
    const note = omitted ? [renderBanner(style, { icon: '⚠️', title: `${omitted} more alerts not shown` })] : [];
    return [...banners, ...note].join(style === Style.Html ? '' : '\n\n');
  };

  let message = compose();
  while (Buffer.byteLength(message) > MAX_BYTES && banners.length > 1) {
    banners.pop();
    omitted++;
    message = compose();
  }
  return Buffer.byteLength(message) > MAX_BYTES ? `${message.slice(0, MAX_BYTES - 16)} … [truncated]` : message;
}

function bannerFor(alert: Alert): Banner {
  const { alertname = 'Alert', severity } = alert.labels;
  const name = severity ? `${alertname} (${severity})` : alertname;
  const labelLine = sortedEntries(alert.labels)
    .filter(([key]) => !HIDDEN_LABELS.has(key))
    .map(([key, value]) => `${key}=${value}`)
    .join('  ');

  if (alert.status === 'resolved') {
    return { icon: '✅', title: `Resolved: ${name}`, details: [labelLine].filter(Boolean) };
  }

  const { description, summary, message, runbook_url: _runbook, ...rest } = alert.annotations ?? {};
  const text = description ?? summary ?? message;
  const details = [...sortedEntries(rest).map(([key, value]) => `${key}: ${value}`), labelLine];
  return { icon: '🔥', title: text ? `${name}: ${text}` : name, details: details.filter(Boolean) };
}

function sortedEntries(labels: Labels): [string, string][] {
  return Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
}
