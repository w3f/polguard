export enum MessageType {
  Firing = 'Firing',
  Resolved = 'Resolved',
  OneTime = 'Event',
  Escalation = 'Escalation',
}

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

export interface MessagePayload {
  title: string;
  preTitle?: string;
  details: string[];
  messageType: MessageType;
  incidentId: string;
  needsAck?: boolean;
}
