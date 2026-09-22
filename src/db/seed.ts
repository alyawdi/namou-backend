import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { db, runMigrations, sqlite } from './client.js';
import { seedCatalogue, seedUser } from './seeder.js';

runMigrations();

const user = await seedUser(db, {
  email: env.SEED_USER_EMAIL,
  password: env.SEED_USER_PASSWORD,
  name: env.SEED_USER_NAME,
});
logger.info({ email: user.email }, 'Demo user ready');

const inserted = seedCatalogue(db);
logger.info(
  inserted ? `Inserted ${inserted} products` : 'Catalogue already present, skipped products',
);

sqlite.close();
