import { Router } from 'express';
import { z } from 'zod';
import { currentUser } from '../../middleware/auth.js';
import { getOrder, listOrders, placeOrder } from './orders.service.js';

const referenceParams = z.object({ reference: z.string().regex(/^NM-[0-9A-Z]{4}-[0-9A-Z]{4}$/) });

export const ordersRouter = Router();

ordersRouter.get('/', (req, res) => {
  res.json({ items: listOrders(currentUser(req).id) });
});

ordersRouter.post('/', (req, res) => {
  const order = placeOrder(currentUser(req).id);
  res.status(201).location(`/api/v1/orders/${order.reference}`).json({ order });
});

ordersRouter.get('/:reference', (req, res) => {
  const { reference } = referenceParams.parse(req.params);
  res.json({ order: getOrder(currentUser(req).id, reference) });
});
