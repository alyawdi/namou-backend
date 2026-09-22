/**
 * Catalogue reads shared by several modules.
 *
 * Services own their own queries; these live here only because the relational
 * include below is needed by products, cart, wishlist and orders alike, and
 * duplicating it would let the shapes drift apart.
 *
 * better-sqlite3 is synchronous, so queries use `.sync()`; that lets the same
 * functions run inside `db.transaction()` callbacks, which must be synchronous.
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { DbExecutor } from '../../db/client.js';
import {
  productImages,
  productOptions,
  productOptionValues,
  products,
  productVariants,
} from '../../db/schema.js';

/**
 * Relational include that loads everything needed to render a product:
 * ordered images, option axes with their values, and variants with the
 * option values that define them.
 */
const productInclude = {
  images: { orderBy: asc(productImages.position) },
  options: {
    orderBy: asc(productOptions.position),
    with: { values: { orderBy: asc(productOptionValues.position) } },
  },
  variants: {
    orderBy: asc(productVariants.position),
    with: { optionValues: { with: { optionValue: true } } },
  },
} as const;

export function findActiveProducts(db: DbExecutor) {
  return db.query.products
    .findMany({
      where: eq(products.isActive, true),
      orderBy: asc(products.id),
      with: productInclude,
    })
    .sync();
}

export function findActiveProductBySlug(db: DbExecutor, slug: string) {
  return db.query.products
    .findFirst({
      where: and(eq(products.slug, slug), eq(products.isActive, true)),
      with: productInclude,
    })
    .sync();
}

export function findActiveProductsByIds(db: DbExecutor, ids: number[]) {
  if (ids.length === 0) return [];
  return db.query.products
    .findMany({
      where: and(inArray(products.id, ids), eq(products.isActive, true)),
      with: productInclude,
    })
    .sync();
}

export function findActiveProductById(db: DbExecutor, id: number) {
  return db.query.products
    .findFirst({
      where: and(eq(products.id, id), eq(products.isActive, true)),
      with: productInclude,
    })
    .sync();
}

/** Loads variants together with their product (and its options) by id. */
export function findVariantsByIds(db: DbExecutor, ids: number[]) {
  if (ids.length === 0) return [];
  return db.query.productVariants
    .findMany({
      where: inArray(productVariants.id, ids),
      with: {
        optionValues: { with: { optionValue: true } },
        product: {
          with: {
            images: { orderBy: asc(productImages.position), limit: 1 },
            options: { orderBy: asc(productOptions.position) },
          },
        },
      },
    })
    .sync();
}

export type ProductRecord = NonNullable<ReturnType<typeof findActiveProductBySlug>>;
export type VariantRecord = ReturnType<typeof findVariantsByIds>[number];
