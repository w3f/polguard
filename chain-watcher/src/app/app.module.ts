import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { ProcessedBlockModule } from './block-tracker/block-tracker.module';
import { AppService } from './app.service';
import { ReconnectableApi } from '@core/api/reconnectable-api';
import { EventDispatcherService } from './event-dispatcher.service';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';

@Module({
  imports: [
    ProcessedBlockModule,
    HealthModule,
    MetricsModule,
    ConfigModule,
  ],
  providers: [
    Logger,
    AppService,
    EventDispatcherService,
    {
      provide: ReconnectableApi,
      useFactory: (logger: Logger) => new ReconnectableApi(logger),
      inject: [Logger],
    },
  ],
})
export class AppModule implements OnModuleInit {
  constructor(
    private reconnectableApi: ReconnectableApi,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    const rpcs = this.configService.getRPCs();
    await this.reconnectableApi.connect(rpcs);
  }
}
