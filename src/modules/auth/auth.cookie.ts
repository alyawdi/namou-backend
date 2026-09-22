import type { CookieOptions, Response } from 'express';
import { isProduction } from '../../config/env.js';

/**
 * In production the `__Host-` prefix forces Secure, Path=/ and no Domain,
 * which stops subdomains from overwriting the cookie.
 */
export const SESSION_COOKIE = isProduction ? '__Host-sid' : 'sid';

const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'lax',
  path: '/',
};

export function setSessionCookie(res: Response, token: string, expires: Date) {
  res.cookie(SESSION_COOKIE, token, { ...baseOptions, expires });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, baseOptions);
}
