import { eq, and, lt, isNotNull, or } from 'drizzle-orm';
import { AppLogger, MessengerType, NotificationType, MESSENGER_STYLE_MAP, MessagePayload, MessageRenderer, sendNotification } from '@w3f/polguard-common';
import type { Database } from '../database/db';
import { incidents, notifications } from '../database/schema';
import { ConfigService } from '../config/config.service';

export class NotificationService {
  constructor(
    private readonly db: Database,
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {}

  parseIncidentMessage(message: string): { title: string; details: string[] } {
    const lines = (message || '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    return { title: lines[0] ?? '', details: lines.slice(1) };
  }

  /**
   * Create notifications for an incident.
   */
  async createNotifications(
    incident: { id: string; needsAck: boolean; isResolved: boolean },
    channels: { channelId: string; messengerType: MessengerType; repeatFiringMs?: number }[],
    type: NotificationType,
    message: string,
  ): Promise<void> {
    const { title, details } = this.parseIncidentMessage(message);

    const basePayload: Omit<MessagePayload, 'kind'> = {
      title,
      details,
      incidentId: incident.id,
      needsAck: incident.needsAck,
      isResolved: incident.isResolved,
    };

    const notificationRows = channels.map(channel => {
      const styleType = MESSENGER_STYLE_MAP[channel.messengerType];
      const styledMessage = MessageRenderer.format(styleType, {
        ...basePayload,
        kind: type,
      });

      return {
        incidentId: incident.id,
        channelId: channel.channelId,
        messengerType: channel.messengerType,
        repeatFiringMs: channel.repeatFiringMs,
        type,
        message: styledMessage,
      };
    });

    const savedNotifications = await this.db.insert(notifications).values(notificationRows).returning();

    // Send notifications immediately
    await Promise.all(savedNotifications.map(n => this.deliverNotification(n)));
  }

  /**
   * Create resolution notifications for an incident.
   */
  async createResolutionNotifications(incident: {
    id: string;
    needsAck: boolean;
    isResolved: boolean;
    resolutionMessage: string | null;
  }): Promise<void> {
    // Find all channels that received alert notifications for this incident
    const alertNotifications = await this.db
      .select()
      .from(notifications)
      .where(and(eq(notifications.incidentId, incident.id), eq(notifications.type, NotificationType.Alert)));

    const channels = alertNotifications.map(alert => ({
      channelId: alert.channelId,
      messengerType: alert.messengerType as MessengerType,
      repeatFiringMs: alert.repeatFiringMs ?? undefined,
    }));

    await this.createNotifications(incident, channels, NotificationType.Resolution, incident.resolutionMessage ?? '');
  }

  /**
   * Deliver a notification by sending it and updating its status.
   */
  private async deliverNotification(notification: typeof notifications.$inferSelect): Promise<void> {
    const isDelivered = await this.send(
      notification.channelId,
      notification.messengerType as MessengerType,
      notification.message,
    );

    await this.db
      .update(notifications)
      .set({ lastSentAt: new Date(), isDelivered, updatedAt: new Date() })
      .where(eq(notifications.id, notification.id));

    if (isDelivered) {
      this.logger.info(
        `Successfully delivered notification ${notification.id} for incident ${notification.incidentId}`,
      );
    } else {
      this.logger.error(`Failed to deliver notification ${notification.id} for incident ${notification.incidentId}`);
    }
  }

  /**
   * Send a message to the external messenger service.
   */
  private async send(channelId: string, messengerType: MessengerType, message: string): Promise<boolean> {
    const url = this.configService.getNotificationConfig().matrix.url;
    return sendNotification(messengerType, url, channelId, message, this.logger);
  }

  /**
   * Retry failed notifications and handle repeating notifications.
   */
  async retryNotifications(): Promise<void> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    const rows = await this.db
      .select({ notification: notifications })
      .from(notifications)
      .leftJoin(incidents, eq(notifications.incidentId, incidents.id))
      .where(
        or(
          // Never delivered successfully
          eq(notifications.isDelivered, false),
          // Delivered but need repeating: unresolved incidents with repeat interval
          and(
            eq(notifications.isDelivered, true),
            lt(notifications.lastSentAt, oneMinuteAgo),
            isNotNull(notifications.repeatFiringMs),
            eq(incidents.isResolved, false),
          ),
        ),
      );

    for (const { notification } of rows) {
      // For repeating notifications, check if the full interval has passed
      if (notification.isDelivered && notification.lastSentAt && notification.repeatFiringMs) {
        const nextSendTime = new Date(notification.lastSentAt.getTime() + notification.repeatFiringMs);
        if (nextSendTime > now) {
          continue;
        }
      }

      await this.deliverNotification(notification);
    }
  }
}
