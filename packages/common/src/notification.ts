import { Chain } from './constants';
import type { IncidentContent } from './incident-dto';

export enum MessengerType {
  Matrix = 'Matrix',
  Slack = 'Slack',
  Telegram = 'Telegram',
}

export enum NotificationType {
  Alert = 'Alert',
  Resolution = 'Resolution',
  Escalation = 'Escalation',
}

export enum Style { Html='html', Markdown='markdown', Plain='plain' }

export const MESSENGER_STYLE_MAP: Record<MessengerType, Style> = {
  [MessengerType.Matrix]: Style.Html,
  [MessengerType.Slack]: Style.Markdown,
  [MessengerType.Telegram]: Style.Html,
};

export function channelLink(messengerType: MessengerType, channelId: string): string {
  return messengerType === MessengerType.Matrix ? `https://matrix.to/#/${channelId}` : channelId;
}

export interface IncidentView {
  incidentId: string;
  type: NotificationType;
  chain: Chain;
  isResolved: boolean;
  needsAck?: boolean;
  content: IncidentContent;
  // Block context used to render the footer (block/event/extrinsic link + chain line).
  blockNumber?: number;
  eventIdx?: number;
  extrinsicIdx?: number;
}

export interface Banner {
  icon: string;
  title: string;
  details?: string[];
}
