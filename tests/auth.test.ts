import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { credentials, loggedInAgent, setupTestApp } from './helpers.js';

let app: Awaited<ReturnType<typeof setupTestApp>>;

beforeAll(async () => {
  app = await setupTestApp();
});

describe('auth', () => {
  it('logs in with valid credentials and sets an httpOnly session cookie', async () => {
    const res = await request(app).post('/api/v1/auth/login').send(credentials()).expect(200);

    expect(res.body.user).toMatchObject({ email: credentials().email });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/sid=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('treats the email case-insensitively', async () => {
    await request(app)
      .post('/api/v1/auth/login')
      .send({ ...credentials(), email: credentials().email.toUpperCase() })
      .expect(200);
  });

  it('rejects a wrong password with a generic error', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ ...credentials(), password: 'wrong-password' })
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects an unknown email with the same error', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever1' })
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('validates the login payload', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns the current user for a valid session', async () => {
    const agent = await loggedInAgent(app);
    const res = await agent.get('/api/v1/auth/me').expect(200);
    expect(res.body.user.email).toBe(credentials().email);
  });

  it('requires a session for protected routes', async () => {
    await request(app).get('/api/v1/auth/me').expect(401);
    await request(app).get('/api/v1/cart').expect(401);
    await request(app).get('/api/v1/wishlist').expect(401);
    await request(app).post('/api/v1/orders').expect(401);
  });

  it('clears a stale session cookie', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', 'sid=not-a-real-session')
      .expect(401);
    expect(String(res.headers['set-cookie'])).toMatch(/sid=;.*Expires=Thu, 01 Jan 1970/);
  });

  it('invalidates the session on logout', async () => {
    const agent = await loggedInAgent(app);
    await agent.post('/api/v1/auth/logout').expect(204);
    await agent.get('/api/v1/auth/me').expect(401);
  });
});
