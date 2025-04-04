import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, LessThan } from 'typeorm';
import { MessageType, MessengerType } from '@w3f/monitoring-types';
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

  async sendAlertNotification(incident: Incident): Promise<void> {
    this.logger.log(`Sending alert notification for incident ${incident.id}`);
    const messageType = incident.resolved ? MessageType.OneTime : MessageType.Firing;
    const styledMessage = MessageStyler.parseAndStyle(incident.message, messageType, 'html', incident.id);
    await this.sendNotification(incident.channelId, incident.messengerType, styledMessage);

    incident.alertNotificationSent = new Date();
    await this.incidentRepository.save(incident);

    this.logger.log(`Alert notification sent for incident ${incident.id}`);
  }

  async sendResolvedNotification(incident: Incident): Promise<void> {
    this.logger.log(`Sending resolved notification for incident ${incident.id}`);
    const messageType = MessageType.Resolved;
    const styledMessage = MessageStyler.parseAndStyle(incident.message, messageType, 'html', incident.id);
    await this.sendNotification(incident.channelId, incident.messengerType, styledMessage);

    incident.resolvedNotificationSent = new Date();
    await this.incidentRepository.save(incident);

    this.logger.log(`Resolved notification sent for incident ${incident.id}`);
  }

  private async sendNotification(channelId: string, messengerType: MessengerType, message: string): Promise<void> {
    const notificationConfig = this.configService.getNotificationConfig();

    switch (messengerType) {
      case MessengerType.Matrix:
        const matrixUrl = notificationConfig.matrix.url;
        await firstValueFrom(
          this.httpService.post(matrixUrl, {
            channelId: channelId,
            message: message,
          }),
        );
        break;

      case MessengerType.Slack:
        throw new NotImplementedException('Slack messenger is not implemented yet');

      default:
        throw new NotImplementedException(`Messenger type ${messengerType} is not implemented`);
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
      // For case 2 only, check if it's time to retry
      if (incident.alertNotificationSent && incident.repeatIntervalHours) {
        const nextNotificationTime = new Date(
          incident.alertNotificationSent.getTime() + incident.repeatIntervalHours * 60 * 60 * 1000,
        );

        // Skip if it's not time yet
        if (nextNotificationTime > now) {
          continue;
        }
      }

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
      await this.sendResolvedNotification(incident);
    }
  }
}
