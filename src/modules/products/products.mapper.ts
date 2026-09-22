/**
 * Maps database records to the API's public shapes. Keeping this separate
 * from queries means the response contract can evolve without touching SQL.
 */
import type { ProductRecord, VariantRecord } from './products.queries.js';

export interface ImageDto {
  url: string;
  alt: string;
}

export interface VariantOptionDto {
  name: string;
  value: string;
}

export interface VariantDto {
  id: number;
  sku: string;
  priceCents: number;
  stock: number;
  inStock: boolean;
  /** Ordered like the product's options. Empty for single-variant products. */
  options: VariantOptionDto[];
  /** e.g. "M / Black"; null for single-variant products. */
  label: string | null;
}

export interface ProductOptionDto {
  name: string;
  values: string[];
}

export interface ProductSummaryDto {
  id: number;
  slug: string;
  title: string;
  image: ImageDto | null;
  /** Lowest variant price. */
  priceCents: number;
  /** Highest variant price; equals priceCents when all variants cost the same. */
  maxPriceCents: number;
  inStock: boolean;
  totalStock: number;
  options: ProductOptionDto[];
  variantCount: number;
  /** Set only when the product has exactly one variant, enabling one-click add to cart. */
  defaultVariantId: number | null;
}

export interface ProductDetailDto extends ProductSummaryDto {
  description: string;
  images: ImageDto[];
  variants: VariantDto[];
}

type OptionLookup = Map<number, { name: string; position: number }>;

function describeVariant(
  optionValues: { optionValue: { optionId: number; value: string } }[],
  options: OptionLookup,
): Pick<VariantDto, 'options' | 'label'> {
  const resolved = optionValues
    .map(({ optionValue }) => ({
      option: options.get(optionValue.optionId),
      value: optionValue.value,
    }))
    .filter((entry): entry is { option: { name: string; position: number }; value: string } =>
      Boolean(entry.option),
    )
    .sort((a, b) => a.option.position - b.option.position)
    .map(({ option, value }) => ({ name: option.name, value }));

  return {
    options: resolved,
    label: resolved.length ? resolved.map((o) => o.value).join(' / ') : null,
  };
}

const lookupFrom = (options: { id: number; name: string; position: number }[]): OptionLookup =>
  new Map(options.map((o) => [o.id, { name: o.name, position: o.position }]));

const toImage = (image: { url: string; alt: string }): ImageDto => ({
  url: image.url,
  alt: image.alt,
});

function toVariantDto(
  variant: Pick<VariantRecord, 'id' | 'sku' | 'priceCents' | 'stock' | 'optionValues'>,
  options: OptionLookup,
): VariantDto {
  return {
    id: variant.id,
    sku: variant.sku,
    priceCents: variant.priceCents,
    stock: variant.stock,
    inStock: variant.stock > 0,
    ...describeVariant(variant.optionValues, options),
  };
}

export function toProductDetail(product: ProductRecord): ProductDetailDto {
  const lookup = lookupFrom(product.options);
  const variants = product.variants.map((v) => toVariantDto(v, lookup));
  const prices = variants.map((v) => v.priceCents);
  const totalStock = variants.reduce((sum, v) => sum + v.stock, 0);
  const firstImage = product.images[0];

  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    description: product.description,
    image: firstImage ? toImage(firstImage) : null,
    images: product.images.map(toImage),
    priceCents: Math.min(...prices),
    maxPriceCents: Math.max(...prices),
    inStock: totalStock > 0,
    totalStock,
    options: product.options.map((o) => ({ name: o.name, values: o.values.map((v) => v.value) })),
    variantCount: variants.length,
    defaultVariantId: variants.length === 1 ? variants[0]!.id : null,
    variants,
  };
}

export function toProductSummary(product: ProductRecord): ProductSummaryDto {
  const { description, images, variants, ...summary } = toProductDetail(product);
  return summary;
}

/** Variant plus the minimal product context needed by cart, wishlist and orders. */
export interface VariantWithProductDto extends VariantDto {
  product: { id: number; slug: string; title: string; image: ImageDto | null };
}

export function toVariantWithProduct(variant: VariantRecord): VariantWithProductDto {
  const { product } = variant;
  const firstImage = product.images[0];
  return {
    ...toVariantDto(variant, lookupFrom(product.options)),
    product: {
      id: product.id,
      slug: product.slug,
      title: product.title,
      image: firstImage ? toImage(firstImage) : null,
    },
  };
}
