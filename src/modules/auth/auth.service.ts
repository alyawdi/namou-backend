import { eq } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { users } from '../../db/schema.js';
import { AppError } from '../../lib/errors.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { deleteExpiredSessions, type AuthUser } from './session.service.js';

const invalidCredentials = () =>
  new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');

// Verified against when the email is unknown, so response time does not reveal
// which emails are registered.
const dummyHash = hashPassword('timing-equaliser');

export async function authenticateWithPassword(email: string, password: string): Promise<AuthUser> {
  const user = db.select().from(users).where(eq(users.email, email)).get();
  const valid = await verifyPassword(password, user?.passwordHash ?? (await dummyHash));
  if (!user || !valid) throw invalidCredentials();

  deleteExpiredSessions();
  return { id: user.id, email: user.email, name: user.name };
}
