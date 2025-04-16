import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationService } from '../notification/notification.service';
import { MonitoringConfigService } from '../monitoring-config/monitoring-config.service';
import { IncidentService } from '../incident/incident.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly monitoringConfigService: MonitoringConfigService,
    private readonly incidentService: IncidentService,
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

  @Cron(CronExpression.EVERY_6_HOURS)
  async autoResolveOrphanedIncidents() {
    this.logger.debug('Running auto-resolution for orphaned incidents');
    const activeAccounts = this.monitoringConfigService.getAllActiveAccounts();
    const resolvedCount = await this.incidentService.autoResolveOrphanedIncidents(activeAccounts);

    if (resolvedCount > 0) {
      this.logger.log(`Auto-resolved ${resolvedCount} incidents for accounts no longer in monitoring configuration`);
    }
  }
}
