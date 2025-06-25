import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { IncidentModule } from './incident/incident.module';
import { NotificationModule } from './notification/notification.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { HealthModule } from './health/health.module';
import { MetricsModule } from './metrics/metrics.module';
import { MonitoringConfigModule } from './monitoring-config/monitoring-config.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        ...configService.getDatabaseConfig(),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: configService.getEnvironment() !== 'production', // Auto-create tables in non-production
      }),
    }),
    HttpModule,
    IncidentModule,
    NotificationModule,
    SchedulerModule,
    HealthModule,
    MetricsModule,
    MonitoringConfigModule,
  ],
})
export class AppModule {}
