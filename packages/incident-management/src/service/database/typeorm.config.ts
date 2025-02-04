import { DataSource } from 'typeorm';
import { ConfigService } from '../config/config.service';

const configService = new ConfigService();
const dbConfig = configService.getDatabaseConfig();

export default new DataSource({
  type: 'postgres',
  host: dbConfig.host,
  port: dbConfig.port,
  username: dbConfig.username,
  password: dbConfig.password,
  database: dbConfig.database,
  entities: ['src/service/**/*.entity.ts'],
  migrations: ['src/service/database/migrations/*.ts'],
});
