import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { setupTestApp } from './helpers.js';

let app: Awaited<ReturnType<typeof setupTestApp>>;

beforeAll(async () => {
  app = await setupTestApp();
});

describe('products', () => {
  it('lists all 15 products publicly', async () => {
    const res = await request(app).get('/api/v1/products').expect(200);
    expect(res.body.items).toHaveLength(15);
  });

  it('includes at least 3 products with more than one variant', async () => {
    const res = await request(app).get('/api/v1/products').expect(200);
    const multi = res.body.items.filter((p: { variantCount: number }) => p.variantCount > 1);
    expect(multi.length).toBeGreaterThanOrEqual(3);
  });

  it('exposes a default variant only for single-variant products', async () => {
    const res = await request(app).get('/api/v1/products').expect(200);
    for (const product of res.body.items) {
      expect(product.defaultVariantId === null).toBe(product.variantCount > 1);
    }
  });

  it('returns product detail with description, stock and labelled variants', async () => {
    const res = await request(app).get('/api/v1/products/classic-cotton-tee').expect(200);
    const { product } = res.body;

    expect(product.description).toEqual(expect.any(String));
    expect(product.options.map((o: { name: string }) => o.name)).toEqual(['Size', 'Color']);
    expect(product.variants).toHaveLength(12);
    expect(product.variants[0]).toMatchObject({
      options: [
        { name: 'Size', value: 'S' },
        { name: 'Color', value: 'White' },
      ],
      label: 'S / White',
      inStock: true,
    });
    expect(product.totalStock).toBe(
      product.variants.reduce((sum: number, v: { stock: number }) => sum + v.stock, 0),
    );
  });

  it('reports price ranges for variants with different prices', async () => {
    const res = await request(app).get('/api/v1/products/insulated-water-bottle').expect(200);
    expect(res.body.product.priceCents).toBe(2200);
    expect(res.body.product.maxPriceCents).toBe(3000);
  });

  it('returns 404 for an unknown product', async () => {
    const res = await request(app).get('/api/v1/products/does-not-exist').expect(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
