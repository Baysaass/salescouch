import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { SCHEMA_SQL } from './schema-sql';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

/**
 * DB холболт:
 *  - DATABASE_URL байвал → Supabase Postgres (Vercel дээр)
 *  - байхгүй бол → ./data/pglite дотор локал PGlite (Postgres-ийн хөнгөн хувилбар)
 * Хоёулаа ижил Postgres схемтэй тул код нэг л байна.
 */
type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const globalForDb = globalThis as unknown as { __db?: Promise<DB> };

async function createDb(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import('postgres');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    // Supabase pooler (transaction mode, 6543) prepared statement дэмжихгүй
    const client = postgres(url, { prepare: false, max: 5, ssl: url.includes('localhost') ? false : 'require' });
    await client.unsafe(SCHEMA_SQL);
    return drizzle(client, { schema }) as unknown as DB;
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const dir = path.join(process.cwd(), 'data', 'pglite');
  fs.mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  await client.waitReady;
  await client.exec(SCHEMA_SQL.replace(/create extension[^;]+;/i, ''));
  return drizzle(client, { schema }) as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!globalForDb.__db) {
    globalForDb.__db = createDb().catch((err) => {
      globalForDb.__db = undefined;
      throw err;
    });
  }
  return globalForDb.__db;
}

export { schema };
