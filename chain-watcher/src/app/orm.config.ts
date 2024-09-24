import { Options, PostgreSqlDriver } from '@mikro-orm/postgresql';
import { AppConfigService } from './config/app-config.service';

function parseDatabaseUrl(dbUrl: string) {
  const url = new URL(dbUrl);
  return {
    host: url.hostname,
    port: parseInt(url.port, 10),
    user: url.username,
    password: url.password,
    dbName: url.pathname.split('/')[1],
  };
}

export async function createMikroOrmConfig(configService: AppConfigService): Promise<Options> {
  const dbUrl = configService.getDatabaseUrl();
  const dbConfig = parseDatabaseUrl(dbUrl);

  return {
    driver: PostgreSqlDriver,
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    dbName: dbConfig.dbName,
    entities: ['dist/**/*.entity.js'],
    entitiesTs: ['src/**/*.entity.ts'],
    debug: process.env.NODE_ENV !== 'production',
  };
}