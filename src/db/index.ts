import 'server-only';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SCHEMA_SQL } from './schema-sql';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

/**
 * DB холболт:
 *  - DATABASE_URL байвал → Supabase Postgres (Vercel дээр)
 *  - байхгүй бол → локал эсвэл /tmp дотор PGlite (Postgres-ийн хөнгөн WASM хувилбар)
 */
type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

const globalForDb = globalThis as unknown as { __db?: Promise<DB> };

async function createDb(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import('postgres');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const client = postgres(url, {
      prepare: false,
      max: 3,
      connect_timeout: 7,
      idle_timeout: 15,
      ssl: url.includes('localhost') ? false : 'require',
    });
    try {
      await client.unsafe(SCHEMA_SQL);
    } catch (e) {
      console.warn('SCHEMA_SQL анхааруулга (хүснэгт аль хэдийн байж магадгүй):', (e as Error).message);
    }
    return drizzle(client, { schema }) as unknown as DB;
  }

  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
  const dir = isServerless ? path.join(os.tmpdir(), 'salescouch-pglite') : path.join(process.cwd(), 'data', 'pglite');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {}
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
