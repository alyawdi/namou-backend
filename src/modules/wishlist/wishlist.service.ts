import { and, desc, eq } from 'drizzle-orm';
import { db, type DbExecutor } from '../../db/client.js';
import { wishlistItems } from '../../db/schema.js';
import { AppError, badRequest, notFound } from '../../lib/errors.js';
import { addItemInTx, getCart, type CartDto } from '../cart/cart.service.js';
import {
  toProductSummary,
  toVariantWithProduct,
  type ProductSummaryDto,
  type VariantWithProductDto,
} from '../products/products.mapper.js';
import {
  findActiveProductById,
  findActiveProductsByIds,
  findVariantsByIds,
} from '../products/products.queries.js';

export interface WishlistItemDto {
  id: number;
  addedAt: string;
  product: ProductSummaryDto;
  /** Variant the user had selected when saving, if any. */
  variant: VariantWithProductDto | null;
}

export interface WishlistDto {
  items: WishlistItemDto[];
}

export function getWishlist(userId: number, tx: DbExecutor = db): WishlistDto {
  const rows = tx
    .select()
    .from(wishlistItems)
    .where(eq(wishlistItems.userId, userId))
    .orderBy(desc(wishlistItems.createdAt), desc(wishlistItems.id))
    .all();

  const products = new Map(
    findActiveProductsByIds(
      tx,
      rows.map((r) => r.productId),
    ).map((p) => [p.id, p]),
  );
  const variants = new Map(
    findVariantsByIds(
      tx,
      rows.flatMap((r) => (r.variantId ? [r.variantId] : [])),
    ).map((v) => [v.id, v]),
  );

  const items: WishlistItemDto[] = [];
  for (const row of rows) {
    const product = products.get(row.productId);
    if (!product) continue;
    const variant = row.variantId ? variants.get(row.variantId) : undefined;
    items.push({
      id: row.id,
      addedAt: row.createdAt.toISOString(),
      product: toProductSummary(product),
      variant: variant ? toVariantWithProduct(variant) : null,
    });
  }
  return { items };
}

/** Idempotent: saving an already-saved product just updates the remembered variant. */
export function addToWishlist(userId: number, productId: number, variantId?: number): WishlistDto {
  return db.transaction((tx) => {
    const product = findActiveProductById(tx, productId);
    if (!product) throw notFound('Product');
    if (variantId !== undefined && !product.variants.some((v) => v.id === variantId)) {
      throw badRequest('Variant does not belong to this product');
    }

    tx.insert(wishlistItems)
      .values({ userId, productId, variantId: variantId ?? null })
      .onConflictDoUpdate({
        target: [wishlistItems.userId, wishlistItems.productId],
        set: { variantId: variantId ?? null },
      })
      .run();
    return getWishlist(userId, tx);
  });
}

function findOwnedItem(tx: DbExecutor, userId: number, itemId: number) {
  const item = tx
    .select()
    .from(wishlistItems)
    .where(and(eq(wishlistItems.id, itemId), eq(wishlistItems.userId, userId)))
    .get();
  if (!item) throw notFound('Wishlist item');
  return item;
}

export function removeFromWishlist(userId: number, itemId: number): WishlistDto {
  return db.transaction((tx) => {
    findOwnedItem(tx, userId, itemId);
    tx.delete(wishlistItems).where(eq(wishlistItems.id, itemId)).run();
    return getWishlist(userId, tx);
  });
}

/**
 * Moves a wishlist item into the cart (quantity 1) and removes it from the
 * wishlist, atomically. The variant is taken from the request, else the one
 * remembered on the wishlist item, else the product's only variant.
 */
export function moveToCart(
  userId: number,
  itemId: number,
  requestedVariantId?: number,
): { cart: CartDto; wishlist: WishlistDto } {
  return db.transaction((tx) => {
    const item = findOwnedItem(tx, userId, itemId);
    const product = findActiveProductById(tx, item.productId);
    if (!product) throw notFound('Product');

    const variantId =
      requestedVariantId ??
      item.variantId ??
      (product.variants.length === 1 ? product.variants[0]!.id : undefined);

    if (variantId === undefined) {
      throw new AppError(400, 'VARIANT_REQUIRED', 'Choose a variant before adding to cart');
    }
    if (!product.variants.some((v) => v.id === variantId)) {
      throw badRequest('Variant does not belong to this product');
    }

    addItemInTx(tx, userId, variantId, 1);
    tx.delete(wishlistItems).where(eq(wishlistItems.id, item.id)).run();
    return { cart: getCart(userId, tx), wishlist: getWishlist(userId, tx) };
  });
}
