import type { NextFunction, Request, Response } from 'express';
import { unauthorized } from '../lib/errors.js';
import {
  clearSessionCookie,
  SESSION_COOKIE,
  setSessionCookie,
} from '../modules/auth/auth.cookie.js';
import { validateSession, type AuthUser } from '../modules/auth/session.service.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
    sessionToken?: string;
  }
}

/** Populates `req.user` when a valid session cookie is present. Never rejects. */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token === 'string' && token.length > 0) {
    const session = validateSession(token);
    if (session) {
      req.user = session.user;
      req.sessionToken = token;
      if (session.renewed) setSessionCookie(res, token, session.expiresAt);
    } else {
      // Expired or revoked: drop the cookie so clients stop presenting it.
      clearSessionCookie(res);
    }
  }
  next();
}

/** Rejects the request with 401 unless `authenticate` resolved a user. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) throw unauthorized();
  next();
}

/** Narrows `req.user` inside handlers mounted behind `requireAuth`. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
