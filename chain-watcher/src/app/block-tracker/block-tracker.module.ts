import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { BlockTrackerService } from './block-tracker.service.js';
import { BlockTracker } from './block-tracker.entity.ts';
import { AppConfigService } from '../config/app-config.service.js';
import { createMikroOrmConfig } from '../orm.config.js';

@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: async (configService: AppConfigService) => {
        return await createMikroOrmConfig(configService);
      },
    }),
    MikroOrmModule.forFeature([BlockTracker]),
  ],
  providers: [BlockTrackerService],
})

export class ProcessedBlockModule {}
