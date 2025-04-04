import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from '../notification/notification.service';
import { MonitoringConfigService } from '../monitoring-config/monitoring-config.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly monitoringConfigService: MonitoringConfigService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleNotificationRetries() {
    this.logger.debug('Running notification retry job');
    await this.notificationService.retryFailedNotifications();
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async refreshMonitoringConfigurations() {
    this.logger.debug('Refreshing monitoring configurations');
    await this.monitoringConfigService.refreshConfigurations();
  }
}
