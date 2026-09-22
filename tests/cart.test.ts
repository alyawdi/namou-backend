import type TestAgent from 'supertest/lib/agent.js';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/client.js';
import { cartItems } from '../src/db/schema.js';
import { loggedInAgent, setupTestApp } from './helpers.js';

interface Variant {
  id: number;
  label: string | null;
  stock: number;
  priceCents: number;
}

let agent: TestAgent;
let tee: Variant[];
let chinos: Variant[];

async function variantsOf(slug: string): Promise<Variant[]> {
  const res = await agent.get(`/api/v1/products/${slug}`).expect(200);
  return res.body.product.variants;
}

beforeAll(async () => {
  const app = await setupTestApp();
  agent = await loggedInAgent(app);
  tee = await variantsOf('classic-cotton-tee');
  chinos = await variantsOf('slim-fit-chinos');
});

beforeEach(() => {
  db.delete(cartItems).run();
});

describe('cart', () => {
  it('starts empty', async () => {
    const res = await agent.get('/api/v1/cart').expect(200);
    expect(res.body.cart).toEqual({ items: [], itemCount: 0, subtotalCents: 0 });
  });

  it('adds an item and computes line and cart totals', async () => {
    const variant = tee[1]!;
    const res = await agent
      .post('/api/v1/cart/items')
      .send({ variantId: variant.id, quantity: 2 })
      .expect(201);

    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0]).toMatchObject({
      quantity: 2,
      lineTotalCents: variant.priceCents * 2,
      variant: { id: variant.id, product: { slug: 'classic-cotton-tee' } },
    });
    expect(res.body.cart.itemCount).toBe(2);
    expect(res.body.cart.subtotalCents).toBe(variant.priceCents * 2);
  });

  it('increments quantity when the same variant is added again', async () => {
    const variant = tee[1]!;
    await agent.post('/api/v1/cart/items').send({ variantId: variant.id }).expect(201);
    const res = await agent.post('/api/v1/cart/items').send({ variantId: variant.id }).expect(201);
    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0].quantity).toBe(2);
  });

  it('refuses to exceed available stock', async () => {
    const variant = chinos[3]!; // 3 in stock
    const res = await agent
      .post('/api/v1/cart/items')
      .send({ variantId: variant.id, quantity: variant.stock + 1 })
      .expect(409);
    expect(res.body.error).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      details: { available: variant.stock },
    });
  });

  it('refuses out-of-stock variants', async () => {
    const hoodie = await variantsOf('everyday-hoodie');
    const soldOut = hoodie.find((v) => v.stock === 0)!;
    await agent.post('/api/v1/cart/items').send({ variantId: soldOut.id }).expect(409);
  });

  it('updates the quantity of an item', async () => {
    const add = await agent.post('/api/v1/cart/items').send({ variantId: tee[0]!.id }).expect(201);
    const itemId = add.body.cart.items[0].id;
    const res = await agent.patch(`/api/v1/cart/items/${itemId}`).send({ quantity: 4 }).expect(200);
    expect(res.body.cart.items[0].quantity).toBe(4);
  });

  it('rejects a quantity of zero (removal is explicit)', async () => {
    const add = await agent.post('/api/v1/cart/items').send({ variantId: tee[0]!.id }).expect(201);
    const itemId = add.body.cart.items[0].id;
    await agent.patch(`/api/v1/cart/items/${itemId}`).send({ quantity: 0 }).expect(400);
  });

  it('switches an item to another variant of the same product', async () => {
    const add = await agent.post('/api/v1/cart/items').send({ variantId: tee[0]!.id }).expect(201);
    const itemId = add.body.cart.items[0].id;
    const res = await agent
      .patch(`/api/v1/cart/items/${itemId}`)
      .send({ variantId: tee[5]!.id })
      .expect(200);
    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0].variant.label).toBe(tee[5]!.label);
  });

  it('merges lines when switching to a variant already in the cart', async () => {
    await agent.post('/api/v1/cart/items').send({ variantId: tee[0]!.id, quantity: 1 });
    const res1 = await agent
      .post('/api/v1/cart/items')
      .send({ variantId: tee[1]!.id, quantity: 2 });
    const first = res1.body.cart.items.find(
      (i: { variant: { id: number } }) => i.variant.id === tee[0]!.id,
    );

    const res = await agent
      .patch(`/api/v1/cart/items/${first.id}`)
      .send({ variantId: tee[1]!.id })
      .expect(200);
    expect(res.body.cart.items).toHaveLength(1);
    expect(res.body.cart.items[0]).toMatchObject({ quantity: 3, variant: { id: tee[1]!.id } });
  });

  it('refuses to switch to a variant of a different product', async () => {
    const add = await agent.post('/api/v1/cart/items').send({ variantId: tee[0]!.id }).expect(201);
    const itemId = add.body.cart.items[0].id;
    await agent
      .patch(`/api/v1/cart/items/${itemId}`)
      .send({ variantId: chinos[0]!.id })
      .expect(400);
  });

  it('removes an item', async () => {
    const add = await agent.post('/api/v1/cart/items').send({ variantId: tee[0]!.id }).expect(201);
    const itemId = add.body.cart.items[0].id;
    const res = await agent.delete(`/api/v1/cart/items/${itemId}`).expect(200);
    expect(res.body.cart.items).toHaveLength(0);
  });

  it('returns 404 for an item that does not exist', async () => {
    await agent.delete('/api/v1/cart/items/999999').expect(404);
  });

  it('returns 404 for an unknown variant', async () => {
    await agent.post('/api/v1/cart/items').send({ variantId: 999999 }).expect(404);
  });
});
