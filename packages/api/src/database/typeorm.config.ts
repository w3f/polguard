import { DataSource } from 'typeorm';
import { ConfigService } from '../config/config.service';
import { Incident, IncidentNotification } from './incident.entities';

const configService = new ConfigService();
const dbConfig = configService.getDatabaseConfig();

export default new DataSource({
  type: 'postgres',
  host: dbConfig.host,
  port: dbConfig.port,
  username: dbConfig.username,
  password: dbConfig.password,
  database: dbConfig.database,
  entities: [Incident, IncidentNotification],
  migrations: ['src/database/migrations/*.ts'],
  synchronize: configService.getEnvironment() !== 'production',
});
