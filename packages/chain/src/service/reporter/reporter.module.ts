import { Module, DynamicModule, Logger } from '@nestjs/common';
import { HttpModule, HttpService } from '@nestjs/axios';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { StdoutIncidentReporter } from './stdout.reporter';
import { IncidentServiceReporter } from './service.reporter';
import { WebhookIncidentReporter } from './webhook.reporter';

@Module({})
export class IncidentReporterModule {
  static forRootAsync(): DynamicModule {
    return {
      module: IncidentReporterModule,
      imports: [HttpModule, ConfigModule],
      providers: [
        Logger,
        {
          provide: 'IncidentReporter',
          useFactory: (config: ConfigService, http: HttpService, logger: Logger) => {
            const reporterConfig = config.getIncidentReporterConfig();

            switch (reporterConfig.type) {
              case 'service':
                return new IncidentServiceReporter(logger, http, config);
              case 'webhook':
                return new WebhookIncidentReporter(logger, http, config);
              case 'stdout':
              default:
                return new StdoutIncidentReporter(logger, reporterConfig.stdout.format);
            }
          },
          inject: [ConfigService, HttpService, Logger],
        },
      ],
      exports: ['IncidentReporter'],
    };
  }
}
