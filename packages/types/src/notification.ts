export enum MessageType {
  Firing = 'Firing',
  Resolved = 'Resolved',
  OneTime = 'Event',
}

export enum MessengerType {
  Matrix = 'Matrix',
  Slack = 'Slack',
  Telegram = 'Telegram',
}

export enum NotificationType {
  Alert = 'Alert',
  Resolution = 'Resolution',
}

export const MESSENGER_STYLE_MAP: Record<MessengerType, 'html' | 'plain' | 'markdown'> = {
  [MessengerType.Matrix]: 'html',
  [MessengerType.Slack]: 'markdown',
  [MessengerType.Telegram]: 'html',
};
