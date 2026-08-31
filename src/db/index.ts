import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { ENV } from '../env';
import * as schema from './schema';

// Bun SQL (bawaan Bun) → PostgreSQL
export const sql = new SQL({ url: ENV.DB_URL });

// drizzle-orm 1.0-rc: signature = drizzle({ client, schema }) — tipe rc belum akurat utk Bun.SQL instance
export const db = (drizzle as any)({ client: sql, schema });
export { schema };
