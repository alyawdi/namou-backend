import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';
import { db, runMigrations } from '../src/db/client.js';
import { seedCatalogue, seedUser } from '../src/db/seeder.js';

/**
 * Each test file gets its own module graph in Vitest, and DATABASE_URL is
 * ":memory:", so every file runs against a fresh, isolated database.
 */
export async function setupTestApp() {
  runMigrations();
  await seedUser(db, {
    email: env.SEED_USER_EMAIL,
    password: env.SEED_USER_PASSWORD,
    name: env.SEED_USER_NAME,
  });
  seedCatalogue(db);
  return createApp();
}

export const credentials = () => ({
  email: env.SEED_USER_EMAIL,
  password: env.SEED_USER_PASSWORD,
});

/** Returns a supertest agent that keeps the session cookie between requests. */
export async function loggedInAgent(app: Awaited<ReturnType<typeof setupTestApp>>) {
  const agent = request.agent(app);
  await agent.post('/api/v1/auth/login').send(credentials()).expect(200);
  return agent;
}
