import { count, eq } from 'drizzle-orm';
import { hashPassword } from '../lib/password.js';
import type { DB, DbExecutor } from './client.js';
import {
  productImages,
  productOptions,
  productOptionValues,
  products,
  productVariants,
  users,
  variantOptionValues,
} from './schema.js';
import { seedProducts, type SeedProduct } from './seed-data/products.js';

export interface SeedUser {
  email: string;
  password: string;
  name: string;
}

/** Creates the demo user if missing, or resets its password/name if present. */
export async function seedUser(db: DB, user: SeedUser) {
  const email = user.email.toLowerCase();
  const passwordHash = await hashPassword(user.password);

  db.insert(users)
    .values({ email, name: user.name, passwordHash })
    .onConflictDoUpdate({ target: users.email, set: { name: user.name, passwordHash } })
    .run();

  return db.select().from(users).where(eq(users.email, email)).get()!;
}

function insertProduct(tx: DbExecutor, seed: SeedProduct) {
  const product = tx
    .insert(products)
    .values({ slug: seed.slug, title: seed.title, description: seed.description })
    .returning({ id: products.id })
    .get();

  seed.images.forEach((image, position) =>
    tx
      .insert(productImages)
      .values({ productId: product.id, ...image, position })
      .run(),
  );

  // option name -> value -> option_value id
  const valueIds = new Map<string, Map<string, number>>();
  seed.options.forEach((option, position) => {
    const { id: optionId } = tx
      .insert(productOptions)
      .values({ productId: product.id, name: option.name, position })
      .returning({ id: productOptions.id })
      .get();

    const ids = new Map<string, number>();
    option.values.forEach((value, valuePosition) => {
      const row = tx
        .insert(productOptionValues)
        .values({ optionId, value, position: valuePosition })
        .returning({ id: productOptionValues.id })
        .get();
      ids.set(value, row.id);
    });
    valueIds.set(option.name, ids);
  });

  seed.variants.forEach((variant, position) => {
    const optionNames = Object.keys(variant.options);
    if (optionNames.length !== seed.options.length) {
      throw new Error(`Variant ${variant.sku} must specify a value for every option`);
    }

    const { id: variantId } = tx
      .insert(productVariants)
      .values({
        productId: product.id,
        sku: variant.sku,
        priceCents: variant.priceCents,
        stock: variant.stock,
        position,
      })
      .returning({ id: productVariants.id })
      .get();

    for (const [name, value] of Object.entries(variant.options)) {
      const optionValueId = valueIds.get(name)?.get(value);
      if (!optionValueId) throw new Error(`Unknown option ${name}=${value} on ${variant.sku}`);
      tx.insert(variantOptionValues).values({ variantId, optionValueId }).run();
    }
  });
}

/** Inserts the catalogue if it is empty. Returns the number of products inserted. */
export function seedCatalogue(db: DB, catalogue: SeedProduct[] = seedProducts): number {
  const existing = db.select({ value: count() }).from(products).get()?.value ?? 0;
  if (existing > 0) return 0;

  db.transaction((tx) => {
    for (const product of catalogue) insertProduct(tx, product);
  });
  return catalogue.length;
}
