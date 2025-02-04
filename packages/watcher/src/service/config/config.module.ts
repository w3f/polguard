import { Module, Logger } from '@nestjs/common';
import { ConfigService } from './config.service';

@Module({
  providers: [
    Logger,
    {
      provide: ConfigService,
      useFactory: async (logger: Logger) => {
        const config = new ConfigService(logger);
        await config.initialize();
        return config;
      },
      inject: [Logger],
    },
  ],
  exports: [ConfigService],
})
export class ConfigModule {}
