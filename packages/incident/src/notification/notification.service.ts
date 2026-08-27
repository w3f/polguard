import { eq, and, or, lt, isNull, isNotNull } from 'drizzle-orm';
import {
  AppLogger,
  Chain,
  MessengerType,
  NotificationType,
  MESSENGER_STYLE_MAP,
  IncidentView,
  IncidentContent,
  renderIncident,
  sendNotification,
} from '@w3f/polguard-common';
import type { Database } from '../database/db';
import { incidents, notifications } from '../database/schema';
import { ConfigService } from '../config/config.service';

const RETRY_AFTER_MS = 5 * 60 * 1000;

export class NotificationService {
  private delivering: Promise<void> = Promise.resolve();

  constructor(
    private readonly db: Database,
    private readonly configService: ConfigService,
    private readonly logger: AppLogger,
  ) {}

  /**
   * Create notifications for an incident.
   */
  async createNotifications(
    incident: { id: string; chain: string; needsAck: boolean; isResolved: boolean },
    channels: { channelId: string; messengerType: MessengerType; repeatFiringMs?: number }[],
    type: NotificationType,
    content: IncidentContent,
    block?: { blockNumber?: number; eventIdx?: number; extrinsicIdx?: number },
  ): Promise<void> {
    const view: IncidentView = {
      incidentId: incident.id,
      type,
      chain: incident.chain as Chain,
      isResolved: incident.isResolved,
      needsAck: incident.needsAck,
      content,
      ...block,
    };

    const notificationRows = channels.map(channel => {
      const styleType = MESSENGER_STYLE_MAP[channel.messengerType];
      const styledMessage = renderIncident(styleType, view);

      return {
        incidentId: incident.id,
        channelId: channel.channelId,
        messengerType: channel.messengerType,
        repeatFiringMs: channel.repeatFiringMs,
        type,
        message: styledMessage,
      };
    });

    await this.db.insert(notifications).values(notificationRows);

    void this.deliver();
  }

  /**
   * Create resolution notifications for an incident.
   */
  async createResolutionNotifications(
    incident: { id: string; chain: string; needsAck: boolean; isResolved: boolean; notificationChannels: unknown },
    content: IncidentContent,
    block?: { blockNumber?: number; eventIdx?: number; extrinsicIdx?: number },
  ): Promise<void> {
    const channels = incident.notificationChannels as { channelId: string; messengerType: MessengerType; repeatFiringMs?: number }[];
    await this.createNotifications(incident, channels, NotificationType.Resolution, content, block);
  }

  /**
   * Deliver queued notifications, in the background. A pass queued while another one is running
   * starts only after it finishes, so it always sees the rows that were just inserted, and a
   * resolution can never overtake its own alert.
   */
  deliver(): Promise<void> {
    this.delivering = this.delivering
      .then(() => this.deliverDue())
      .catch(error => this.logger.error(`Notification delivery failed: ${(error as Error).message}`));

    return this.delivering;
  }

  private async deliverDue(): Promise<void> {
    const retryCutoff = new Date(Date.now() - RETRY_AFTER_MS);

    const due = await this.db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.isDelivered, false),
          or(isNull(notifications.lastSentAt), lt(notifications.lastSentAt, retryCutoff)),
        ),
      )
      // `id` is serial, so this is insertion order: an alert is always sent before its resolution.
      .orderBy(notifications.id);

    for (const notification of due) {
      await this.deliverNotification(notification);
    }
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
   * Re-send notifications for incidents that are still firing.
   */
  async sendRepeatNotifications(): Promise<void> {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

    const rows = await this.db
      .select({ notification: notifications })
      .from(notifications)
      .leftJoin(incidents, eq(notifications.incidentId, incidents.id))
      .where(
        and(
          eq(notifications.isDelivered, true),
          lt(notifications.lastSentAt, oneMinuteAgo),
          isNotNull(notifications.repeatFiringMs),
          eq(incidents.isResolved, false),
        ),
      );

    for (const { notification } of rows) {
      const nextSendTime = new Date(notification.lastSentAt!.getTime() + notification.repeatFiringMs!);
      if (nextSendTime > now) {
        continue;
      }

      await this.deliverNotification(notification);
    }
  }
}
