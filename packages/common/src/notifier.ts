import { fetchOrThrow } from './http';
import { AppLogger } from './logging';
import { MessengerType } from './notification';

export async function sendNotification(
  messengerType: MessengerType,
  url: string,
  channelId: string,
  message: string,
  logger: AppLogger,
): Promise<boolean> {
  switch (messengerType) {
    case MessengerType.Matrix:
      try {
        await fetchOrThrow(`${url}/${encodeURIComponent(channelId)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        });
        return true;
      } catch (error) {
        logger.error(`Failed to notify ${channelId}: ${String(error)}`);
        return false;
      }
    default:
      logger.warn(`Messenger type ${messengerType} is not implemented; skipping ${channelId}`);
      return false;
  }
}
