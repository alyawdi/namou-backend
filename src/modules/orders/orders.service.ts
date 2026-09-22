import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, gte, sql, type SQL } from 'drizzle-orm';
import { db, type DbExecutor } from '../../db/client.js';
import { orderItems, orders, productVariants, type OrderStatus } from '../../db/schema.js';
import { AppError, notFound } from '../../lib/errors.js';
import { clearCart, getCart } from '../cart/cart.service.js';

export interface OrderItemDto {
  id: number;
  productId: number | null;
  productSlug: string;
  productTitle: string;
  variantLabel: string | null;
  sku: string;
  unitPriceCents: number;
  quantity: number;
  lineTotalCents: number;
}

export interface OrderDto {
  reference: string;
  status: OrderStatus;
  placedAt: string;
  itemCount: number;
  subtotalCents: number;
  totalCents: number;
  items: OrderItemDto[];
}

// Crockford base32 without ambiguous characters (no I, L, O, U).
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function generateReference() {
  const bytes = randomBytes(8);
  const code = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `NM-${code.slice(0, 4)}-${code.slice(4)}`;
}

function loadOrder(tx: DbExecutor, where: SQL | undefined): OrderDto | null {
  const order = tx.query.orders
    .findFirst({ where, with: { items: { orderBy: [asc(orderItems.id)] } } })
    .sync();
  if (!order) return null;

  return {
    reference: order.reference,
    status: order.status,
    placedAt: order.createdAt.toISOString(),
    itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
    subtotalCents: order.subtotalCents,
    totalCents: order.totalCents,
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productSlug: item.productSlug,
      productTitle: item.productTitle,
      variantLabel: item.variantLabel,
      sku: item.sku,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      lineTotalCents: item.lineTotalCents,
    })),
  };
}

/**
 * Converts the user's cart into an order in one transaction:
 * re-validate stock, decrement it, snapshot the lines, clear the cart.
 * Either everything succeeds or nothing changes.
 */
export function placeOrder(userId: number): OrderDto {
  return db.transaction((tx) => {
    const cart = getCart(userId, tx);
    if (cart.items.length === 0) {
      throw new AppError(400, 'CART_EMPTY', 'Your cart is empty');
    }

    const shortages = cart.items
      .filter((item) => item.quantity > item.variant.stock)
      .map((item) => ({
        cartItemId: item.id,
        sku: item.variant.sku,
        requested: item.quantity,
        available: item.variant.stock,
      }));
    if (shortages.length > 0) {
      throw new AppError(
        409,
        'INSUFFICIENT_STOCK',
        'Some items in your cart are no longer available in the requested quantity',
        { items: shortages },
      );
    }

    for (const item of cart.items) {
      // Guarded decrement: the WHERE clause makes over-selling impossible even
      // if another writer changed stock since the cart was read.
      const result = tx
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} - ${item.quantity}` })
        .where(
          and(eq(productVariants.id, item.variant.id), gte(productVariants.stock, item.quantity)),
        )
        .run();
      if (result.changes !== 1) {
        throw new AppError(409, 'INSUFFICIENT_STOCK', 'Stock changed while placing your order');
      }
    }

    const order = tx
      .insert(orders)
      .values({
        reference: generateReference(),
        userId,
        subtotalCents: cart.subtotalCents,
        totalCents: cart.subtotalCents,
      })
      .returning({ id: orders.id })
      .get();

    tx.insert(orderItems)
      .values(
        cart.items.map((item) => ({
          orderId: order.id,
          productId: item.variant.product.id,
          variantId: item.variant.id,
          productSlug: item.variant.product.slug,
          productTitle: item.variant.product.title,
          variantLabel: item.variant.label,
          sku: item.variant.sku,
          unitPriceCents: item.variant.priceCents,
          quantity: item.quantity,
          lineTotalCents: item.lineTotalCents,
        })),
      )
      .run();

    clearCart(userId, tx);
    return loadOrder(tx, eq(orders.id, order.id))!;
  });
}

export function getOrder(userId: number, reference: string): OrderDto {
  const order = loadOrder(db, and(eq(orders.reference, reference), eq(orders.userId, userId)));
  if (!order) throw notFound('Order');
  return order;
}

export function listOrders(userId: number): Omit<OrderDto, 'items'>[] {
  const rows = db.query.orders
    .findMany({
      where: eq(orders.userId, userId),
      orderBy: [desc(orders.createdAt), desc(orders.id)],
      with: { items: { columns: { quantity: true } } },
    })
    .sync();

  return rows.map((order) => ({
    reference: order.reference,
    status: order.status,
    placedAt: order.createdAt.toISOString(),
    itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
    subtotalCents: order.subtotalCents,
    totalCents: order.totalCents,
  }));
}
