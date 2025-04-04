import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, LessThan } from 'typeorm';
import { Message, MessageType, MessengerType } from '@w3f/monitoring-types';
import { Incident } from '../database/incident.entity';
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
    private readonly configService: ConfigService,
  ) {}

  async sendAlertNotification(incident: Incident): Promise<boolean> {
    this.logger.log(`Sending alert notification for incident ${incident.id}`);

    if (!incident.channelId) {
      this.logger.warn(`No channel ID for incident ${incident.id}, skipping notification`);
      return false;
    }

    try {
      // Determine message type based on incident properties
      const messageType = incident.resolved ? MessageType.OneTime : MessageType.Firing;

      // Parse message content into title and details
      const messageLines = incident.message.split('\n').filter(line => line.trim() !== '');
      const title = messageLines[0] || '';
      const details = messageLines.slice(1) || [];

      // Create message object
      const messageObj: Message = {
        title,
        details,
      };

      // Apply style to message
      const styledMessage = MessageStyler.applyStyle(messageObj, messageType, 'html');

      // Send notification based on messenger type
      await this.sendNotification(incident, styledMessage);

      this.logger.log(`Alert notification sent for incident ${incident.id}`);

      // Update alertNotificationSent
      incident.alertNotificationSent = new Date();
      await this.incidentRepository.save(incident);

      return true;
    } catch (error) {
      this.logger.error(`Failed to send alert notification for incident ${incident.id}`, error);
      return false;
    }
  }

  async sendResolvedNotification(incident: Incident): Promise<boolean> {
    this.logger.log(`Sending resolved notification for incident ${incident.id}`);

    if (!incident.channelId || !incident.resolvedMessage) {
      this.logger.warn(`No channel ID or resolved message for incident ${incident.id}, skipping notification`);
      return false;
    }

    try {
      // Parse message content into title and details
      const messageLines = incident.resolvedMessage.split('\n').filter(line => line.trim() !== '');
      const title = messageLines[0] || '';
      const details = messageLines.slice(1) || [];

      // TODO: Add incident.id to the message details?

      // Create message object
      const messageObj: Message = {
        title,
        details,
      };

      // Apply style to message
      const styledMessage = MessageStyler.applyStyle(messageObj, MessageType.Resolved, 'html');

      // Send notification based on messenger type
      await this.sendNotification(incident, styledMessage);

      this.logger.log(`Resolved notification sent for incident ${incident.id}`);

      // Update resolvedNotificationSent
      incident.resolvedNotificationSent = new Date();
      await this.incidentRepository.save(incident);

      return true;
    } catch (error) {
      this.logger.error(`Failed to send resolved notification for incident ${incident.id}`, error);
      return false;
    }
  }

  private async sendNotification(incident: Incident, message: string): Promise<void> {
    const notificationConfig = this.configService.getNotificationConfig();

    switch (incident.messengerType) {
      case MessengerType.Matrix:
        const matrixUrl = notificationConfig.matrix.url;
        await firstValueFrom(
          this.httpService.post(matrixUrl, {
            channelId: incident.channelId,
            message: message,
            incidentId: incident.id,
          }),
        );
        break;

      case MessengerType.Slack:
        throw new NotImplementedException('Slack messenger is not implemented yet');

      default:
        throw new NotImplementedException(`Messenger type ${incident.messengerType} is not implemented`);
    }
  }

  async retryFailedNotifications(): Promise<void> {
    await this.retryOneTimeNotifications();
    await this.retryFiringNotifications();
    await this.retryResolvedNotifications();
  }

  private async retryOneTimeNotifications(): Promise<void> {
    const now = new Date();

    // Find one-time incidents that were created as resolved but notification failed
    const oneTimeIncidents = await this.incidentRepository.find({
      where: {
        resolved: true,
        alertNotificationSent: IsNull(),
        createdAt: LessThan(
          new Date(now.getTime() - 1 * 60 * 1000), // Created at least 1 minute ago
        ),
      },
    });

    // Process one-time incidents
    for (const incident of oneTimeIncidents) {
      await this.sendAlertNotification(incident);
    }
  }

  private async retryFiringNotifications(): Promise<void> {
    const now = new Date();

    // Find firing incidents that need notification sending/retrying
    const firingIncidents = await this.incidentRepository.find({
      where: [
        // Case 1: Never sent a notification (alertNotificationSent is null)
        {
          resolved: false,
          alertNotificationSent: IsNull(),
          createdAt: LessThan(
            new Date(now.getTime() - 1 * 60 * 1000), // Created at least 1 minute ago
          ),
        },
        // Case 2: Failed to send recurring notification (alertNotificationSent + repeatIntervalHours has passed)
        {
          resolved: false,
          repeatIntervalHours: Not(IsNull()),
          alertNotificationSent: Not(IsNull()),
        },
      ],
    });

    // Process firing incidents
    for (const incident of firingIncidents) {
      // For case 2, check if it's time to retry
      if (incident.alertNotificationSent && incident.repeatIntervalHours) {
        const nextNotificationTime = new Date(
          incident.alertNotificationSent.getTime() + incident.repeatIntervalHours * 60 * 60 * 1000,
        );

        // Skip if it's not time yet
        if (nextNotificationTime > now) {
          continue;
        }
      }

      // Try to send the notification
      await this.sendAlertNotification(incident);
    }
  }

  private async retryResolvedNotifications(): Promise<void> {
    // Find incidents that were resolved but resolution notification failed
    const resolvedIncidents = await this.incidentRepository.find({
      where: {
        resolved: true,
        resolvedNotificationSent: IsNull(),
        resolvedMessage: Not(IsNull()),
        resolvedAt: Not(IsNull()),
      },
    });

    // Process resolved incidents
    for (const incident of resolvedIncidents) {
      const result = await this.sendResolvedNotification(incident);

      // Update resolvedNotificationSent if notification was sent successfully
      if (result) {
        incident.resolvedNotificationSent = new Date();
        await this.incidentRepository.save(incident);
      }
    }
  }
}
