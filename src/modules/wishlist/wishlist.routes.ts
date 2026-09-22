import { Router } from 'express';
import { z } from 'zod';
import { currentUser } from '../../middleware/auth.js';
import { idParams, idSchema } from '../../lib/validation.js';
import { addToWishlist, getWishlist, moveToCart, removeFromWishlist } from './wishlist.service.js';

const addSchema = z.object({ productId: idSchema, variantId: idSchema.optional() });
const moveSchema = z.object({ variantId: idSchema.optional() }).default({});

export const wishlistRouter = Router();

wishlistRouter.get('/', (req, res) => {
  res.json({ wishlist: getWishlist(currentUser(req).id) });
});

wishlistRouter.post('/items', (req, res) => {
  const { productId, variantId } = addSchema.parse(req.body);
  res.status(201).json({ wishlist: addToWishlist(currentUser(req).id, productId, variantId) });
});

wishlistRouter.delete('/items/:id', (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json({ wishlist: removeFromWishlist(currentUser(req).id, id) });
});

wishlistRouter.post('/items/:id/move-to-cart', (req, res) => {
  const { id } = idParams.parse(req.params);
  const { variantId } = moveSchema.parse(req.body ?? {});
  res.json(moveToCart(currentUser(req).id, id, variantId));
});
