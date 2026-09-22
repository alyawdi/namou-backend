import type TestAgent from 'supertest/lib/agent.js';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/client.js';
import { cartItems, wishlistItems } from '../src/db/schema.js';
import { loggedInAgent, setupTestApp } from './helpers.js';

let agent: TestAgent;

async function product(slug: string) {
  const res = await agent.get(`/api/v1/products/${slug}`).expect(200);
  return res.body.product as { id: number; variants: { id: number }[] };
}

beforeAll(async () => {
  const app = await setupTestApp();
  agent = await loggedInAgent(app);
});

beforeEach(() => {
  db.delete(wishlistItems).run();
  db.delete(cartItems).run();
});

describe('wishlist', () => {
  it('adds a product and lists it', async () => {
    const tee = await product('classic-cotton-tee');
    await agent.post('/api/v1/wishlist/items').send({ productId: tee.id }).expect(201);

    const res = await agent.get('/api/v1/wishlist').expect(200);
    expect(res.body.wishlist.items).toHaveLength(1);
    expect(res.body.wishlist.items[0]).toMatchObject({
      product: { slug: 'classic-cotton-tee' },
      variant: null,
    });
  });

  it('is idempotent per product', async () => {
    const tee = await product('classic-cotton-tee');
    await agent.post('/api/v1/wishlist/items').send({ productId: tee.id }).expect(201);
    const res = await agent
      .post('/api/v1/wishlist/items')
      .send({ productId: tee.id, variantId: tee.variants[2]!.id })
      .expect(201);
    expect(res.body.wishlist.items).toHaveLength(1);
    expect(res.body.wishlist.items[0].variant.id).toBe(tee.variants[2]!.id);
  });

  it('rejects a variant from another product', async () => {
    const tee = await product('classic-cotton-tee');
    const bag = await product('leather-crossbody-bag');
    await agent
      .post('/api/v1/wishlist/items')
      .send({ productId: tee.id, variantId: bag.variants[0]!.id })
      .expect(400);
  });

  it('removes an item', async () => {
    const tee = await product('classic-cotton-tee');
    const add = await agent.post('/api/v1/wishlist/items').send({ productId: tee.id });
    const res = await agent
      .delete(`/api/v1/wishlist/items/${add.body.wishlist.items[0].id}`)
      .expect(200);
    expect(res.body.wishlist.items).toHaveLength(0);
  });

  it('moves a single-variant product to the cart without asking for a variant', async () => {
    const board = await product('bamboo-cutting-board');
    const add = await agent.post('/api/v1/wishlist/items').send({ productId: board.id });

    const res = await agent
      .post(`/api/v1/wishlist/items/${add.body.wishlist.items[0].id}/move-to-cart`)
      .expect(200);
    expect(res.body.wishlist.items).toHaveLength(0);
    expect(res.body.cart.items[0]).toMatchObject({
      quantity: 1,
      variant: { id: board.variants[0]!.id },
    });
  });

  it('requires a variant for multi-variant products with none remembered', async () => {
    const tee = await product('classic-cotton-tee');
    const add = await agent.post('/api/v1/wishlist/items').send({ productId: tee.id });
    const itemId = add.body.wishlist.items[0].id;

    const res = await agent.post(`/api/v1/wishlist/items/${itemId}/move-to-cart`).expect(400);
    expect(res.body.error.code).toBe('VARIANT_REQUIRED');

    const moved = await agent
      .post(`/api/v1/wishlist/items/${itemId}/move-to-cart`)
      .send({ variantId: tee.variants[1]!.id })
      .expect(200);
    expect(moved.body.cart.items[0].variant.id).toBe(tee.variants[1]!.id);
  });

  it('keeps the item in the wishlist if the move fails for lack of stock', async () => {
    const sunglasses = await product('polarized-sunglasses'); // out of stock
    const add = await agent.post('/api/v1/wishlist/items').send({ productId: sunglasses.id });
    await agent
      .post(`/api/v1/wishlist/items/${add.body.wishlist.items[0].id}/move-to-cart`)
      .expect(409);

    const res = await agent.get('/api/v1/wishlist').expect(200);
    expect(res.body.wishlist.items).toHaveLength(1);
  });
});
