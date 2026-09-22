import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router } from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env, isProduction, isTest } from './config/env.js';
import { sqlite } from './db/client.js';
import { logger } from './lib/logger.js';
import { authenticate, requireAuth } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { cartRouter } from './modules/cart/cart.routes.js';
import { ordersRouter } from './modules/orders/orders.routes.js';
import { productsRouter } from './modules/products/products.routes.js';
import { wishlistRouter } from './modules/wishlist/wishlist.routes.js';

export function createApp() {
  const app = express();

  // In production the platform's proxy (Fly) terminates TLS and forwards the
  // client IP in X-Forwarded-For; trusting one hop keeps rate limiting per-user
  // instead of bucketing everyone under the proxy's address. Locally, requests
  // arrive through the Next.js rewrite on the same host.
  app.set('trust proxy', isProduction ? 1 : 'loopback');
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (!isTest)
    app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

  app.get('/health', (_req, res) => {
    sqlite.prepare('SELECT 1').get();
    res.json({ status: 'ok' });
  });

  const api = Router();
  api.use(authenticate);
  api.use('/auth', authRouter);
  api.use('/products', productsRouter);
  api.use('/cart', requireAuth, cartRouter);
  api.use('/wishlist', requireAuth, wishlistRouter);
  api.use('/orders', requireAuth, ordersRouter);

  app.use('/api/v1', api);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
