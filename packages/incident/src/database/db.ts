import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type Database = NodePgDatabase<typeof schema>;

export function createDatabase(connectionConfig: {
  host: string;
  port: number;
  user: string;
  password?: string;
  database: string;
}): Database {
  return drizzle({
    connection: connectionConfig,
    schema,
  });
}
