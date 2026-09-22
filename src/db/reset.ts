/**
 * Drops the local database file and rebuilds it from migrations + seed.
 * Development only.
 */
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { env, isProduction } from '../config/env.js';

if (isProduction) throw new Error('db:reset is disabled in production');

if (env.DATABASE_URL !== ':memory:') {
  const file = resolve(env.DATABASE_URL);
  for (const suffix of ['', '-wal', '-shm']) rmSync(file + suffix, { force: true });
}

await import('./seed.js');
