import { Router } from 'express';
import { z } from 'zod';
import { currentUser } from '../../middleware/auth.js';
import { idParams, idSchema } from '../../lib/validation.js';
import { addItem, getCart, MAX_QUANTITY_PER_ITEM, removeItem, updateItem } from './cart.service.js';

const quantitySchema = z.number().int().min(1).max(MAX_QUANTITY_PER_ITEM);

const addItemSchema = z.object({
  variantId: idSchema,
  quantity: quantitySchema.default(1),
});

const updateItemSchema = z
  .object({ quantity: quantitySchema.optional(), variantId: idSchema.optional() })
  .refine((body) => body.quantity !== undefined || body.variantId !== undefined, {
    message: 'Provide quantity and/or variantId',
  });

export const cartRouter = Router();

cartRouter.get('/', (req, res) => {
  res.json({ cart: getCart(currentUser(req).id) });
});

cartRouter.post('/items', (req, res) => {
  const { variantId, quantity } = addItemSchema.parse(req.body);
  res.status(201).json({ cart: addItem(currentUser(req).id, variantId, quantity) });
});

cartRouter.patch('/items/:id', (req, res) => {
  const { id } = idParams.parse(req.params);
  const changes = updateItemSchema.parse(req.body);
  res.json({ cart: updateItem(currentUser(req).id, id, changes) });
});

cartRouter.delete('/items/:id', (req, res) => {
  const { id } = idParams.parse(req.params);
  res.json({ cart: removeItem(currentUser(req).id, id) });
});
