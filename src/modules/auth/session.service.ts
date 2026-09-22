import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, lt } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../db/client.js';
import { sessions, users } from '../../db/schema.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const sessionTtlMs = () => env.SESSION_TTL_DAYS * DAY_MS;

export interface AuthUser {
  id: number;
  email: string;
  name: string;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Creates a session and returns the raw token to be placed in the cookie. */
export function createSession(userId: number) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + sessionTtlMs());
  db.insert(sessions)
    .values({ id: hashToken(token), userId, expiresAt })
    .run();
  return { token, expiresAt };
}

/**
 * Resolves a token to its user. Sessions past half their lifetime are
 * extended (sliding expiry) so active users are not logged out mid-visit.
 */
export function validateSession(token: string) {
  const id = hashToken(token);
  const row = db
    .select({
      expiresAt: sessions.expiresAt,
      user: { id: users.id, email: users.email, name: users.name },
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, new Date())))
    .get();

  if (!row) return null;

  let { expiresAt } = row;
  if (expiresAt.getTime() - Date.now() < sessionTtlMs() / 2) {
    expiresAt = new Date(Date.now() + sessionTtlMs());
    db.update(sessions).set({ expiresAt }).where(eq(sessions.id, id)).run();
  }

  return { user: row.user satisfies AuthUser, expiresAt, renewed: expiresAt !== row.expiresAt };
}

export function deleteSession(token: string) {
  db.delete(sessions)
    .where(eq(sessions.id, hashToken(token)))
    .run();
}

export function deleteExpiredSessions() {
  db.delete(sessions).where(lt(sessions.expiresAt, new Date())).run();
}
