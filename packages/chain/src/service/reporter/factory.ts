import type { AppLogger } from '@w3f/polguard-common';
import type { IncidentReporter } from '../../types';
import type { ConfigService } from '../config/config.service';
import { StdoutIncidentReporter } from './stdout.reporter';
import { IncidentServiceReporter } from './service.reporter';
import { WebhookIncidentReporter } from './webhook.reporter';

/**
 * Creates the appropriate IncidentReporter implementation based on configuration.
 */
export function createReporter(config: ConfigService, logger: AppLogger): IncidentReporter {
  const reporterConfig = config.getIncidentReporterConfig();

  switch (reporterConfig.type) {
    case 'service':
      return new IncidentServiceReporter(logger, config);
    case 'webhook':
      return new WebhookIncidentReporter(logger, config);
    case 'stdout':
    default:
      return new StdoutIncidentReporter(logger, reporterConfig.stdout!.format);
  }
}
