import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { ConfigService } from '../config/config.service';
import { Logger } from '@nestjs/common';
import { Incident } from './incident.entity';
import { Notification } from './notification.entity';
import { LastBlock } from './last-block.entity';
import * as path from 'node:path';

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
  entities: [Incident, Notification, LastBlock],
  migrations: [path.join(__dirname, 'migrations/**/*{.ts,.js}')],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: configService.getEnvironment() !== 'production',
});
