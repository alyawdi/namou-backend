import { and, asc, eq } from 'drizzle-orm';
import { db, type DbExecutor } from '../../db/client.js';
import { cartItems } from '../../db/schema.js';
import { AppError, badRequest, notFound } from '../../lib/errors.js';
import { toVariantWithProduct, type VariantWithProductDto } from '../products/products.mapper.js';
import { findVariantsByIds, type VariantRecord } from '../products/products.queries.js';

export const MAX_QUANTITY_PER_ITEM = 99;

export interface CartItemDto {
  id: number;
  quantity: number;
  lineTotalCents: number;
  /** True when stock dropped below the quantity after the item was added. */
  exceedsStock: boolean;
  variant: VariantWithProductDto;
}

export interface CartDto {
  items: CartItemDto[];
  /** Sum of quantities across all lines. */
  itemCount: number;
  subtotalCents: number;
}

export const insufficientStock = (sku: string, requested: number, available: number) =>
  new AppError(
    409,
    'INSUFFICIENT_STOCK',
    available === 0 ? 'This item is out of stock' : `Only ${available} left in stock`,
    { sku, requested, available },
  );

function loadPurchasableVariant(tx: DbExecutor, variantId: number): VariantRecord {
  const [variant] = findVariantsByIds(tx, [variantId]);
  if (!variant || !variant.product.isActive) throw notFound('Product variant');
  return variant;
}

function assertStock(variant: VariantRecord, quantity: number) {
  if (quantity > MAX_QUANTITY_PER_ITEM) {
    throw badRequest(`You can order at most ${MAX_QUANTITY_PER_ITEM} of an item`);
  }
  if (quantity > variant.stock) throw insufficientStock(variant.sku, quantity, variant.stock);
}

function findOwnedItem(tx: DbExecutor, userId: number, itemId: number) {
  const item = tx
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.id, itemId), eq(cartItems.userId, userId)))
    .get();
  if (!item) throw notFound('Cart item');
  return item;
}

function findItemByVariant(tx: DbExecutor, userId: number, variantId: number) {
  return tx
    .select()
    .from(cartItems)
    .where(and(eq(cartItems.userId, userId), eq(cartItems.variantId, variantId)))
    .get();
}

export function getCart(userId: number, tx: DbExecutor = db): CartDto {
  const rows = tx
    .select()
    .from(cartItems)
    .where(eq(cartItems.userId, userId))
    .orderBy(asc(cartItems.createdAt), asc(cartItems.id))
    .all();

  const variants = new Map(
    findVariantsByIds(
      tx,
      rows.map((r) => r.variantId),
    ).map((v) => [v.id, v]),
  );

  const items: CartItemDto[] = [];
  for (const row of rows) {
    const variant = variants.get(row.variantId);
    // Items whose product was deactivated are hidden rather than purchasable.
    if (!variant || !variant.product.isActive) continue;
    items.push({
      id: row.id,
      quantity: row.quantity,
      lineTotalCents: row.quantity * variant.priceCents,
      exceedsStock: row.quantity > variant.stock,
      variant: toVariantWithProduct(variant),
    });
  }

  return {
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotalCents: items.reduce((sum, i) => sum + i.lineTotalCents, 0),
  };
}

/**
 * Adds a variant to the cart. Adding a variant that is already in the cart
 * increases its quantity instead of creating a duplicate line.
 */
export function addItem(userId: number, variantId: number, quantity: number): CartDto {
  return db.transaction((tx) => {
    addItemInTx(tx, userId, variantId, quantity);
    return getCart(userId, tx);
  });
}

export function addItemInTx(tx: DbExecutor, userId: number, variantId: number, quantity: number) {
  const variant = loadPurchasableVariant(tx, variantId);
  const existing = findItemByVariant(tx, userId, variantId);
  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  assertStock(variant, nextQuantity);

  if (existing) {
    tx.update(cartItems).set({ quantity: nextQuantity }).where(eq(cartItems.id, existing.id)).run();
  } else {
    tx.insert(cartItems).values({ userId, variantId, quantity }).run();
  }
}

/**
 * Updates quantity and/or switches the item to another variant of the same
 * product. Switching to a variant already in the cart merges the two lines.
 */
export function updateItem(
  userId: number,
  itemId: number,
  changes: { quantity?: number | undefined; variantId?: number | undefined },
): CartDto {
  return db.transaction((tx) => {
    const item = findOwnedItem(tx, userId, itemId);
    const quantity = changes.quantity ?? item.quantity;
    const targetVariantId = changes.variantId ?? item.variantId;

    if (targetVariantId === item.variantId) {
      assertStock(loadPurchasableVariant(tx, item.variantId), quantity);
      tx.update(cartItems).set({ quantity }).where(eq(cartItems.id, item.id)).run();
      return getCart(userId, tx);
    }

    const [current] = findVariantsByIds(tx, [item.variantId]);
    const target = loadPurchasableVariant(tx, targetVariantId);
    if (current && current.productId !== target.productId) {
      throw badRequest('A cart item can only switch to a variant of the same product');
    }

    const duplicate = findItemByVariant(tx, userId, targetVariantId);
    if (duplicate) {
      const merged = duplicate.quantity + quantity;
      assertStock(target, merged);
      tx.update(cartItems).set({ quantity: merged }).where(eq(cartItems.id, duplicate.id)).run();
      tx.delete(cartItems).where(eq(cartItems.id, item.id)).run();
    } else {
      assertStock(target, quantity);
      tx.update(cartItems)
        .set({ variantId: targetVariantId, quantity })
        .where(eq(cartItems.id, item.id))
        .run();
    }
    return getCart(userId, tx);
  });
}

export function removeItem(userId: number, itemId: number): CartDto {
  return db.transaction((tx) => {
    const item = findOwnedItem(tx, userId, itemId);
    tx.delete(cartItems).where(eq(cartItems.id, item.id)).run();
    return getCart(userId, tx);
  });
}

export function clearCart(userId: number, tx: DbExecutor = db) {
  tx.delete(cartItems).where(eq(cartItems.userId, userId)).run();
}
