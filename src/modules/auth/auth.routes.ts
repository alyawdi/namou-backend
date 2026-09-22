import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { isTest } from '../../config/env.js';
import { currentUser, requireAuth } from '../../middleware/auth.js';
import { clearSessionCookie, setSessionCookie } from './auth.cookie.js';
import { authenticateWithPassword } from './auth.service.js';
import { createSession, deleteSession } from './session.service.js';

const loginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1).max(200),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => isTest,
  message: {
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many login attempts, try again later' },
  },
});

export const authRouter = Router();

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await authenticateWithPassword(email, password);
  const { token, expiresAt } = createSession(user.id);
  setSessionCookie(res, token, expiresAt);
  res.json({ user });
});

authRouter.post('/logout', (req, res) => {
  if (req.sessionToken) deleteSession(req.sessionToken);
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get('/me', requireAuth, (req, res) => {
  res.json({ user: currentUser(req) });
});
