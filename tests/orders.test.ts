import { eq } from 'drizzle-orm';
import type TestAgent from 'supertest/lib/agent.js';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/client.js';
import { cartItems, productVariants } from '../src/db/schema.js';
import { loggedInAgent, setupTestApp } from './helpers.js';

let agent: TestAgent;

async function firstVariant(slug: string) {
  const res = await agent.get(`/api/v1/products/${slug}`).expect(200);
  return res.body.product.variants[0] as { id: number; stock: number; priceCents: number };
}

const stockOf = (variantId: number) =>
  db.select().from(productVariants).where(eq(productVariants.id, variantId)).get()!.stock;

beforeAll(async () => {
  const app = await setupTestApp();
  agent = await loggedInAgent(app);
});

beforeEach(() => {
  db.delete(cartItems).run();
});

describe('orders', () => {
  it('refuses to place an order with an empty cart', async () => {
    const res = await agent.post('/api/v1/orders').expect(400);
    expect(res.body.error.code).toBe('CART_EMPTY');
  });

  it('places an order: snapshots lines, decrements stock and clears the cart', async () => {
    const notebook = await firstVariant('canvas-notebook-set');
    const candle = await firstVariant('soy-wax-candle');
    const stockBefore = stockOf(notebook.id);

    await agent.post('/api/v1/cart/items').send({ variantId: notebook.id, quantity: 2 });
    await agent.post('/api/v1/cart/items').send({ variantId: candle.id, quantity: 1 });

    const res = await agent.post('/api/v1/orders').expect(201);
    const { order } = res.body;

    expect(order.reference).toMatch(/^NM-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(order.items).toHaveLength(2);
    expect(order.itemCount).toBe(3);
    expect(order.totalCents).toBe(notebook.priceCents * 2 + candle.priceCents);
    expect(order.items[1]).toMatchObject({
      productTitle: 'Soy Wax Candle',
      variantLabel: 'Cedar & Sage',
    });

    expect(stockOf(notebook.id)).toBe(stockBefore - 2);
    const cart = await agent.get('/api/v1/cart').expect(200);
    expect(cart.body.cart.items).toHaveLength(0);

    const fetched = await agent.get(`/api/v1/orders/${order.reference}`).expect(200);
    expect(fetched.body.order).toEqual(order);

    const list = await agent.get('/api/v1/orders').expect(200);
    expect(list.body.items[0].reference).toBe(order.reference);
  });

  it('rejects checkout and changes nothing if stock dropped after adding to cart', async () => {
    const bag = await firstVariant('leather-crossbody-bag');
    const notebook = await firstVariant('canvas-notebook-set');
    await agent.post('/api/v1/cart/items').send({ variantId: notebook.id, quantity: 1 });
    await agent.post('/api/v1/cart/items').send({ variantId: bag.id, quantity: 2 });

    const notebookStock = stockOf(notebook.id);
    db.update(productVariants).set({ stock: 1 }).where(eq(productVariants.id, bag.id)).run();

    const res = await agent.post('/api/v1/orders').expect(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
    expect(res.body.error.details.items).toEqual([
      expect.objectContaining({ requested: 2, available: 1 }),
    ]);

    // Nothing was committed
    expect(stockOf(notebook.id)).toBe(notebookStock);
    const cart = await agent.get('/api/v1/cart').expect(200);
    expect(cart.body.cart.items).toHaveLength(2);
    expect(cart.body.cart.items[1].exceedsStock).toBe(true);
  });

  it('returns 404 for an order reference that does not exist', async () => {
    await agent.get('/api/v1/orders/NM-0000-0000').expect(404);
  });
});
