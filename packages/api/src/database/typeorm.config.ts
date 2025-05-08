import { DataSource } from 'typeorm';
import { ConfigService } from '../config/config.service';
import { Logger } from '@nestjs/common';
import { Incident, IncidentNotification } from './incident.entity';
import * as path from 'path';

const logger = new Logger('ConfigService');
const configService = new ConfigService(logger);
const dbConfig = configService.getDatabaseConfig();

export default new DataSource({
  type: 'postgres',
  host: dbConfig.host,
  port: dbConfig.port,
  username: dbConfig.username,
  password: dbConfig.password,
  database: dbConfig.database,
  entities: [Incident, IncidentNotification],
  migrations: [path.join(__dirname, 'migrations/**/*{.ts,.js}')],
  synchronize: configService.getEnvironment() !== 'production',
});
