import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database, { type RunResult } from 'better-sqlite3';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { SQLiteTransaction } from 'drizzle-orm/sqlite-core';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { env } from '../config/env.js';
import * as schema from './schema.js';

const MIGRATIONS_FOLDER = resolve(dirname(fileURLToPath(import.meta.url)), '../../drizzle');

function openDatabase(url: string) {
  if (url !== ':memory:') mkdirSync(dirname(resolve(url)), { recursive: true });

  const sqlite = new Database(url);
  // WAL gives concurrent readers alongside a writer; FKs are off by default in SQLite.
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  return sqlite;
}

export const sqlite = openDatabase(env.DATABASE_URL);
export const db = drizzle(sqlite, { schema });

export type DB = typeof db;
export type Transaction = SQLiteTransaction<
  'sync',
  RunResult,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;
/** Accepted by any function that must work standalone or inside a transaction. */
export type DbExecutor = DB | Transaction;

export function runMigrations() {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
