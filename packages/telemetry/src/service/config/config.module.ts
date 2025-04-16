import { Module, Logger } from '@nestjs/common';
import { ConfigService } from './config.service';

@Module({
  providers: [Logger, ConfigService],
  exports: [ConfigService],
})
export class ConfigModule {}
