import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, LessThan } from 'typeorm';
import { MessageType, MessengerType, NotificationType } from '@w3f/monitoring-types';
import { Incident, IncidentNotification } from '../database/incident.entities';
import { MessageStyler } from './message-styler';
import { ConfigService } from '../config/config.service';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly httpService: HttpService,
    @InjectRepository(Incident)
    private incidentRepository: Repository<Incident>,
    @InjectRepository(IncidentNotification)
    private notificationRepository: Repository<IncidentNotification>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create notifications for an incident
   */
  async createNotifications(
    incident: Incident,
    channels: { channelId: string; messengerType: MessengerType; repeatHours?: number }[],
    type: NotificationType,
  ): Promise<void> {
    const notifications = channels.map(channel => ({
      incident,
      channelId: channel.channelId,
      messengerType: channel.messengerType,
      repeatHours: channel.repeatHours,
      type,
    }));

    const savedNotifications = await this.notificationRepository.save(notifications);

    // Process each notification (don't wait for completion)
    savedNotifications.forEach(notification => {
      this.processNotification(notification).catch(error => {
        this.logger.error(`Failed to process notification ${notification.id}`, error);
      });
    });
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
    }));

    await this.createNotifications(incident, channels, NotificationType.Resolution);
  }

  /**
   * Process a single notification
   */
  async processNotification(notification: IncidentNotification): Promise<void> {
    const incident = await this.incidentRepository.findOne({
      where: { id: notification.incident.id },
    });

    if (!incident) {
      this.logger.error(`Incident ${notification.incident.id} not found for notification ${notification.id}`);
      return;
    }

    const messageType =
      notification.type === NotificationType.Alert
        ? incident.isResolved
          ? MessageType.OneTime
          : MessageType.Firing
        : MessageType.Resolved;

    const styledMessage = MessageStyler.parseAndStyle(incident.message, messageType, 'html', incident.id);
    const isDelivered = await this.sendNotification(notification.channelId, notification.messengerType, styledMessage);

    notification.lastSentAt = new Date();
    notification.isDelivered = isDelivered;
    await this.notificationRepository.save(notification);

    if (isDelivered) {
      this.logger.log(`Successfully processed notification ${notification.id} for incident ${incident.id}`);
    } else {
      this.logger.error(`Failed to deliver notification ${notification.id} for incident ${incident.id}`);
    }
  }

  /**
   * Send a notification to a specific channel
   * @returns boolean indicating whether the notification was sent successfully
   */
  private async sendNotification(channelId: string, messengerType: MessengerType, message: string): Promise<boolean> {
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

        // Needs to be repeated based on interval
        {
          isDelivered: true,
          repeatHours: Not(IsNull()),
          lastSentAt: LessThan(
            new Date(now.getTime() - 60 * 1000), // At least 1 minute ago (safety buffer)
          ),
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
      if (notification.isDelivered && notification.repeatHours && notification.lastSentAt) {
        const nextSendTime = new Date(notification.lastSentAt.getTime() + notification.repeatHours * 60 * 60 * 1000);

        if (nextSendTime > now) {
          continue;
        }
      }

      await this.processNotification(notification);
    }
  }
}
