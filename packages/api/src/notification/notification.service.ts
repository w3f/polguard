import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not, IsNull } from 'typeorm';
import { MessengerType, NotificationType, MESSENGER_STYLE_MAP, MessagePayload } from '@w3f/monitoring-types';
import { Incident } from '../database/incident.entity';
import { Notification } from '../database/notification.entity';
import { MessageRenderer } from './message-renderer';
import { ConfigService } from '../config/config.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Incident)
    private incidentRepository: Repository<Incident>,
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    private readonly configService: ConfigService,
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
   * @param message - Optional message to use instead of incident.message
   */
  async createNotifications(
    incident: Incident,
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

    const notifications = channels.map(channel => {
      const styleType = MESSENGER_STYLE_MAP[channel.messengerType];

      const styledMessage = MessageRenderer.format(styleType, {
        ...basePayload,
        kind: type,
      });

      return {
        incident,
        channelId: channel.channelId,
        messengerType: channel.messengerType,
        repeatFiringMs: channel.repeatFiringMs,
        type,
        message: styledMessage,
      };
    });

    const savedNotifications = await this.notificationRepository.save(notifications);

    // Send notifications immediately
    await Promise.all(savedNotifications.map(notification => this.deliverNotification(notification)));
  }

  /**
   * Create resolution notifications for an incident
   */
  async createResolutionNotifications(incident: Incident): Promise<void> {
    // Find all channels that received alert notifications for this incident
    const alertNotifications = await this.notificationRepository.find({
      where: {
        incident: { id: incident.id },
        type: NotificationType.Alert,
      },
    });

    const channels = alertNotifications.map(alert => ({
      channelId: alert.channelId,
      messengerType: alert.messengerType,
      repeatFiringMs: alert.repeatFiringMs,
    }));

    await this.createNotifications(incident, channels, NotificationType.Resolution, incident.resolutionMessage);
  }

  /**
   * Deliver a notification by sending it and updating its status
   */
  private async deliverNotification(notification: Notification): Promise<void> {
    const isDelivered = await this.send(notification.channelId, notification.messengerType, notification.message);

    notification.lastSentAt = new Date();
    notification.isDelivered = isDelivered;
    await this.notificationRepository.save(notification);

    if (isDelivered) {
      this.logger.log(
        `Successfully delivered notification ${notification.id} for incident ${notification.incident.id}`,
      );
    } else {
      this.logger.error(`Failed to deliver notification ${notification.id} for incident ${notification.incident.id}`);
    }
  }

  /**
   * Send a message to the external messenger service
   * @returns boolean indicating whether the message was sent successfully
   */
  private async send(channelId: string, messengerType: MessengerType, message: string): Promise<boolean> {
    const notificationConfig = this.configService.getNotificationConfig();

    try {
      switch (messengerType) {
        case MessengerType.Matrix:
          const matrixUrl = notificationConfig.matrix.url;
          const response = await firstValueFrom(
            this.httpService.post(matrixUrl, {
              channelId: channelId,
              message: message,
            }),
          );
          if (response.status >= 200 && response.status < 300) {
            return true;
          } else {
            this.logger.error(`Failed to send notification: Received status code ${response.status}`);
            return false;
          }

        case MessengerType.Slack:
          throw new NotImplementedException('Slack messenger is not implemented yet');

        default:
          throw new NotImplementedException(`Messenger type ${messengerType} is not implemented`);
      }
    } catch (error) {
      this.logger.error(`Failed to send notification to ${messengerType} channel ${channelId}`, error);
      return false;
    }
  }

  /**
   * Retry failed notifications and handle repeating notifications
   */
  async retryNotifications(): Promise<void> {
    const now = new Date();
    const pendingNotifications = await this.notificationRepository.find({
      where: [
        // Never delivered successfully
        { isDelivered: false },

        // Firing unresolved incidents which need to be repeated based on interval
        {
          isDelivered: true,
          lastSentAt: LessThan(
            new Date(now.getTime() - 60 * 1000), // At least 1 minute ago (safety buffer)
          ),
          repeatFiringMs: Not(IsNull()),
          // Only repeat for unresolved incidents
          incident: {
            isResolved: false,
          },
        },
      ],
      relations: ['incident'],
    });

    for (const notification of pendingNotifications) {
      // For repeating notifications, check if the full interval has passed
      if (notification.isDelivered && notification.lastSentAt) {
        const nextSendTime = new Date(notification.lastSentAt.getTime() + notification.repeatFiringMs);

        if (nextSendTime > now) {
          continue;
        }
      }

      await this.deliverNotification(notification);
    }
  }
}
