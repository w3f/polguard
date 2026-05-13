import { CronJob } from 'cron';
import type { AppLogger } from '@w3f/polguard-common';
import { ConfigService } from '../config/config.service';
import { NotificationService } from '../notification/notification.service';
import { IncidentService } from '../incident/incident.service';

const DEFAULT_CRON_5_MINUTES = '*/5 * * * *';
const DEFAULT_CRON_6_HOURS = '0 */6 * * *';

export class SchedulerService {
  private readonly jobs = new Map<string, CronJob>();

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationService: NotificationService,
    private readonly incidentService: IncidentService,
    private readonly logger: AppLogger,
  ) {}

  start() {
    const sched = this.configService.getCronsConfig();

    this.addCronJob('notifications-escalations', sched.escalations ?? DEFAULT_CRON_5_MINUTES, async () => {
      this.logger.debug('Running escalation check');
      await this.incidentService.escalateIncidents();
    });

    this.addCronJob('notifications-retries', sched.retries ?? DEFAULT_CRON_5_MINUTES, async () => {
      this.logger.debug('Running notification retry job');
      await this.notificationService.retryNotifications();
    });

    this.addCronJob('auto-resolve-stale', sched.autoResolve ?? DEFAULT_CRON_6_HOURS, async () => {
      this.logger.debug('Running auto-resolution for stale incidents');
      await this.incidentService.autoResolveStaleIncidents();
    });
  }

  stop() {
    for (const [name, job] of this.jobs) {
      job.stop();
      this.logger.info(`Cron job "${name}" stopped`);
    }
    this.jobs.clear();
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

    this.jobs.set(name, job);
    this.logger.info(`Cron job "${name}" scheduled: ${cronTime}`);
  }
}
