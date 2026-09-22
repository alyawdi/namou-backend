import { Router } from 'express';
import { z } from 'zod';
import { db } from '../../db/client.js';
import { notFound } from '../../lib/errors.js';
import { toProductDetail, toProductSummary } from './products.mapper.js';
import { findActiveProductBySlug, findActiveProducts } from './products.queries.js';

const slugParams = z.object({ slug: z.string().regex(/^[a-z0-9-]{1,120}$/) });

export const productsRouter = Router();

productsRouter.get('/', (_req, res) => {
  res.json({ items: findActiveProducts(db).map(toProductSummary) });
});

productsRouter.get('/:slug', (req, res) => {
  const { slug } = slugParams.parse(req.params);
  const product = findActiveProductBySlug(db, slug);
  if (!product) throw notFound('Product');
  res.json({ product: toProductDetail(product) });
});
