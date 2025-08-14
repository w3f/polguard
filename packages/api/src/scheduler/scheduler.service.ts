import { CronJob } from 'cron';
import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { SchedulerRegistry, CronExpression } from '@nestjs/schedule';

import { ConfigService } from '../config/config.service';
import { NotificationService } from '../notification/notification.service';
import { MonitoringConfigService } from '../monitoring-config/monitoring-config.service';
import { IncidentService } from '../incident/incident.service';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly monitoringConfigService: MonitoringConfigService,
    private readonly incidentService: IncidentService,
  ) {}

  onModuleInit() {
    const sched = this.configService.getCronsConfig?.() ?? {};

    const exprEscalations = sched.escalations ?? CronExpression.EVERY_5_MINUTES;
    const exprRetries = sched.retries ?? CronExpression.EVERY_5_MINUTES;
    const exprRefreshCfg = sched.refreshConfig ?? CronExpression.EVERY_5_MINUTES;
    const exprAutoResolve = sched.autoResolve ?? CronExpression.EVERY_6_HOURS;

    this.addCronJob('notifications-escalations', exprEscalations, async () => {
      this.logger.debug('Running escalation check');
      await this.incidentService.escalateIncidents();
    });

    this.addCronJob('notifications-retries', exprRetries, async () => {
      this.logger.debug('Running notification retry job');
      await this.notificationService.retryNotifications();
    });

    this.addCronJob('refresh-config', exprRefreshCfg, async () => {
      this.logger.debug('Refreshing monitoring configurations');
      await this.monitoringConfigService.refreshConfigurations();
    });

    this.addCronJob('auto-resolve-orphaned', exprAutoResolve, async () => {
      this.logger.debug('Running auto-resolution for orphaned incidents');
      const active = this.monitoringConfigService.getAllActiveAccounts();
      const resolved = await this.incidentService.autoResolveOrphanedIncidents(active);
      if (resolved > 0) {
        this.logger.log(`Auto-resolved ${resolved} orphaned incidents`);
      }
    });
  }

  onModuleDestroy() {
    for (const [name, job] of this.schedulerRegistry.getCronJobs()) {
      job.stop();
      this.logger.log(`Cron job "${name}" stopped`);
    }
  }

  private addCronJob(name: string, cronTime: string, task: () => Promise<void>) {
    const job = CronJob.from({
      cronTime,
      onTick: task,
      waitForCompletion: true,
      start: true,
      errorHandler: err => {
        this.logger.error(`Cron job "${name}" failed`, err as Error);
      },
    });

    this.schedulerRegistry.addCronJob(name, job);
    this.logger.log(`Cron job "${name}" scheduled: ${cronTime}`);
  }
}
