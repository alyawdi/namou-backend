/**
 * Catalogue seed: 15 products, 8 of which have more than one variant.
 *
 * Images are intentionally empty for now. Add `{ url, alt }` entries to a
 * product's `images` array (stock photo URLs or files served by the frontend)
 * and re-run `npm run db:reset`.
 */

export interface SeedVariant {
  sku: string;
  /** Option name -> value, e.g. { Size: 'M', Color: 'Black' }. Empty for single-variant products. */
  options: Record<string, string>;
  priceCents: number;
  stock: number;
}

export interface SeedProduct {
  slug: string;
  title: string;
  description: string;
  images: { url: string; alt: string }[];
  options: { name: string; values: string[] }[];
  variants: SeedVariant[];
}

/** Builds every combination of the given option values. */
function combinations(options: SeedProduct['options']): Record<string, string>[] {
  return options.reduce<Record<string, string>[]>(
    (acc, option) =>
      acc.flatMap((combo) => option.values.map((value) => ({ ...combo, [option.name]: value }))),
    [{}],
  );
}

const skuPart = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 4);

/**
 * Generates a product whose variants are the full cartesian product of its options.
 * `price` and `stock` may vary per combination.
 */
function withVariants(
  base: Omit<SeedProduct, 'variants'> & { skuPrefix: string },
  price: (combo: Record<string, string>) => number,
  stock: (combo: Record<string, string>, index: number) => number,
): SeedProduct {
  const { skuPrefix, ...product } = base;
  return {
    ...product,
    variants: combinations(product.options).map((combo, index) => ({
      sku: [skuPrefix, ...Object.values(combo).map(skuPart)].join('-'),
      options: combo,
      priceCents: price(combo),
      stock: stock(combo, index),
    })),
  };
}

function single(
  base: Omit<SeedProduct, 'variants' | 'options'>,
  sku: string,
  priceCents: number,
  stock: number,
): SeedProduct {
  return { ...base, options: [], variants: [{ sku, options: {}, priceCents, stock }] };
}

export const seedProducts: SeedProduct[] = [
  withVariants(
    {
      slug: 'classic-cotton-tee',
      skuPrefix: 'TEE',
      title: 'Classic Cotton Tee',
      description:
        'A wardrobe staple cut from 100% combed organic cotton. Mid-weight 180gsm jersey, a relaxed-but-tidy fit and a reinforced collar that keeps its shape wash after wash. Pre-shrunk, so the size you buy is the size you keep.',
      images: [
        { url: '/products/classic-cotton-tee-1.webp', alt: 'Plain white cotton t-shirt laid flat' },
        {
          url: '/products/classic-cotton-tee-2.webp',
          alt: 'Black and white cotton t-shirts folded side by side',
        },
      ],
      options: [
        { name: 'Size', values: ['S', 'M', 'L', 'XL'] },
        { name: 'Color', values: ['White', 'Black', 'Sage'] },
      ],
    },
    () => 2400,
    (_, i) => [12, 20, 18, 6][i % 4]!,
  ),
  withVariants(
    {
      slug: 'everyday-hoodie',
      skuPrefix: 'HOOD',
      title: 'Everyday Hoodie',
      description:
        'Brushed-back fleece hoodie with a double-layer hood, kangaroo pocket and ribbed cuffs. Heavy enough for cool evenings, breathable enough to wear indoors. Garment-dyed for a soft, lived-in feel from day one.',
      images: [
        { url: '/products/everyday-hoodie-2.webp', alt: 'Person wearing a grey hoodie outdoors' },
        {
          url: '/products/everyday-hoodie-1.webp',
          alt: 'Light grey hooded sweatshirt worn against a dark backdrop',
        },
      ],
      options: [
        { name: 'Size', values: ['S', 'M', 'L'] },
        { name: 'Color', values: ['Heather Grey', 'Navy'] },
      ],
    },
    () => 5900,
    (combo) => (combo.Size === 'S' && combo.Color === 'Navy' ? 0 : 8),
  ),
  withVariants(
    {
      slug: 'slim-fit-chinos',
      skuPrefix: 'CHINO',
      title: 'Slim Fit Chinos',
      description:
        'Tailored chinos in a stretch cotton twill that moves with you. A slim leg that tapers slightly below the knee, a hidden coin pocket and a clean finish that works from the office to the weekend.',
      images: [
        {
          url: '/products/slim-fit-chinos-1.webp',
          alt: 'Folded beige chinos beside a book and glasses',
        },
        {
          url: '/products/slim-fit-chinos-2.webp',
          alt: 'Grey chino trousers laid flat on a dark table',
        },
      ],
      options: [{ name: 'Waist', values: ['30', '32', '34', '36'] }],
    },
    () => 4900,
    (_, i) => [5, 14, 11, 3][i]!,
  ),
  withVariants(
    {
      slug: 'leather-crossbody-bag',
      skuPrefix: 'BAG',
      title: 'Leather Crossbody Bag',
      description:
        'Compact full-grain leather crossbody with an adjustable strap, magnetic flap closure and two interior card slots. Fits a phone, wallet and keys with room to spare. The leather develops a rich patina over time.',
      images: [
        {
          url: '/products/leather-crossbody-bag-1.webp',
          alt: 'Tan leather crossbody bag with a shoulder strap',
        },
        {
          url: '/products/leather-crossbody-bag-2.webp',
          alt: 'Black leather crossbody bag on a white surface',
        },
      ],
      options: [{ name: 'Color', values: ['Tan', 'Black'] }],
    },
    () => 8900,
    () => 7,
  ),
  withVariants(
    {
      slug: 'wireless-earbuds-pro',
      skuPrefix: 'BUDS',
      title: 'Wireless Earbuds Pro',
      description:
        'Active noise-cancelling earbuds with 8 hours of playback (30 with the case), transparency mode and multipoint Bluetooth 5.3. IPX4 sweat resistance and three sizes of silicone tips in the box.',
      images: [
        {
          url: '/products/wireless-earbuds-pro-1.webp',
          alt: 'White wireless earbuds in an open charging case',
        },
        {
          url: '/products/wireless-earbuds-pro-2.webp',
          alt: 'Closed earbud charging case showing the USB-C port',
        },
      ],
      options: [{ name: 'Color', values: ['Midnight', 'Pearl'] }],
    },
    () => 12900,
    (combo) => (combo.Color === 'Pearl' ? 2 : 15),
  ),
  withVariants(
    {
      slug: 'insulated-water-bottle',
      skuPrefix: 'BTL',
      title: 'Insulated Water Bottle',
      description:
        'Double-wall vacuum-insulated stainless steel keeps drinks cold for 24 hours or hot for 12. Leak-proof lid, powder-coated grip and a mouth wide enough for ice cubes. BPA-free and dishwasher safe.',
      images: [
        {
          url: '/products/insulated-water-bottle-1.webp',
          alt: 'Three insulated stainless steel water bottles',
        },
        {
          url: '/products/insulated-water-bottle-2.webp',
          alt: 'Single insulated water bottle standing on a plain surface',
        },
      ],
      options: [{ name: 'Capacity', values: ['500 ml', '750 ml', '1 L'] }],
    },
    (combo) => ({ '500 ml': 2200, '750 ml': 2600, '1 L': 3000 })[combo.Capacity!]!,
    () => 25,
  ),
  single(
    {
      slug: 'pour-over-coffee-set',
      title: 'Ceramic Pour-Over Coffee Set',
      description:
        'A hand-glazed ceramic dripper and matching 600 ml carafe for slow, flavourful coffee. Includes 40 unbleached paper filters. Brews one to four cups and looks beautiful on the counter between uses.',
      images: [
        {
          url: '/products/pour-over-coffee-set-1.webp',
          alt: 'Water being poured through a filter into a glass coffee carafe',
        },
        {
          url: '/products/pour-over-coffee-set-2.webp',
          alt: 'Pour-over coffee brewing into a carafe',
        },
      ],
    },
    'POUR-SET',
    4500,
    9,
  ),
  single(
    {
      slug: 'merino-wool-beanie',
      title: 'Merino Wool Beanie',
      description:
        'Fine-knit merino beanie that is warm without the itch. Naturally temperature-regulating and odour-resistant, with a fold-over cuff you can wear up or down. One size fits most.',
      images: [
        {
          url: '/products/merino-wool-beanie-1.webp',
          alt: 'Grey knitted merino wool beanie resting on wood',
        },
        { url: '/products/merino-wool-beanie-2.webp', alt: 'Person wearing a grey knitted beanie' },
      ],
    },
    'BEANIE-MER',
    1900,
    30,
  ),
  withVariants(
    {
      slug: 'trail-running-sneakers',
      skuPrefix: 'RUN',
      title: 'Trail Running Sneakers',
      description:
        'Lightweight trail runners with a grippy lugged outsole, a responsive foam midsole and a breathable mesh upper. A protective toe cap and gusseted tongue keep grit out on technical terrain.',
      images: [
        {
          url: '/products/trail-running-sneakers-1.webp',
          alt: 'Pair of trail running shoes on a white background',
        },
        { url: '/products/trail-running-sneakers-2.webp', alt: 'Close-up of a trail running shoe' },
      ],
      options: [{ name: 'EU Size', values: ['40', '41', '42', '43', '44'] }],
    },
    () => 11000,
    (_, i) => [3, 6, 9, 6, 1][i]!,
  ),
  withVariants(
    {
      slug: 'linen-throw-pillow',
      skuPrefix: 'PILLOW',
      title: 'Linen Throw Pillow',
      description:
        'Stonewashed European linen cover with a concealed zip and a plump feather-blend insert. 50 × 50 cm. The cover is removable and machine washable, and softens with every wash.',
      images: [
        { url: '/products/linen-throw-pillow-2.webp', alt: 'Linen throw pillow on a grey sofa' },
        {
          url: '/products/linen-throw-pillow-1.webp',
          alt: 'Linen cushions in natural tones stacked on a chair',
        },
      ],
      options: [{ name: 'Color', values: ['Sand', 'Olive', 'Terracotta'] }],
    },
    () => 3400,
    () => 10,
  ),
  single(
    {
      slug: 'bamboo-cutting-board',
      title: 'Bamboo Cutting Board',
      description:
        'Sustainably harvested bamboo board with a deep juice groove on one side and a flat serving face on the other. Gentle on knife edges and naturally antimicrobial. 38 × 28 cm.',
      images: [
        {
          url: '/products/bamboo-cutting-board-1.webp',
          alt: 'Bamboo cutting board with a handle on a white background',
        },
        {
          url: '/products/bamboo-cutting-board-2.webp',
          alt: 'Bamboo cutting board seen from above',
        },
      ],
    },
    'BOARD-BAMB',
    2900,
    16,
  ),
  withVariants(
    {
      slug: 'soy-wax-candle',
      skuPrefix: 'CANDLE',
      title: 'Soy Wax Candle',
      description:
        'Hand-poured soy wax candle with a cotton wick and a 45-hour burn time. Scented with essential-oil blends and presented in a reusable amber glass jar.',
      images: [
        { url: '/products/soy-wax-candle-1.webp', alt: 'Lit soy wax candle in an amber glass jar' },
        { url: '/products/soy-wax-candle-2.webp', alt: 'Several soy candles in amber jars' },
      ],
      options: [{ name: 'Scent', values: ['Cedar & Sage', 'Lavender', 'Citrus Grove'] }],
    },
    () => 1800,
    () => 22,
  ),
  withVariants(
    {
      slug: 'mechanical-keyboard',
      skuPrefix: 'KB',
      title: 'Compact Mechanical Keyboard',
      description:
        '75% layout mechanical keyboard with hot-swappable switches, PBT keycaps and an aluminium top case. Connects over USB-C, Bluetooth or 2.4 GHz, with up to 200 hours of battery life.',
      images: [
        {
          url: '/products/mechanical-keyboard-1.webp',
          alt: 'Compact mechanical keyboard on an orange background',
        },
        {
          url: '/products/mechanical-keyboard-2.webp',
          alt: 'Compact mechanical keyboard with yellow keycaps',
        },
      ],
      options: [{ name: 'Switch', values: ['Linear Red', 'Tactile Brown', 'Clicky Blue'] }],
    },
    (combo) => (combo.Switch === 'Clicky Blue' ? 13900 : 14900),
    (_, i) => [4, 7, 5][i]!,
  ),
  single(
    {
      slug: 'canvas-notebook-set',
      title: 'Canvas Notebook Set',
      description:
        'Set of three A5 notebooks with durable canvas covers and 80 pages each of 100gsm dotted paper that resists bleed-through. Lay-flat binding and a back pocket for loose notes.',
      images: [
        { url: '/products/canvas-notebook-set-2.webp', alt: 'Notebooks stacked in a neat pile' },
        {
          url: '/products/canvas-notebook-set-1.webp',
          alt: 'Stack of notebooks with coloured covers',
        },
      ],
    },
    'NOTE-SET3',
    1600,
    40,
  ),
  single(
    {
      slug: 'polarized-sunglasses',
      title: 'Polarized Sunglasses',
      description:
        'Classic acetate frames with polarized, UV400-rated lenses that cut glare off water and roads. Spring hinges for a comfortable fit, supplied with a hard case and microfibre cloth.',
      images: [
        {
          url: '/products/polarized-sunglasses-1.webp',
          alt: 'Polarized sunglasses with light acetate frames',
        },
        {
          url: '/products/polarized-sunglasses-2.webp',
          alt: 'Sunglasses resting on a white surface',
        },
      ],
    },
    'SUN-POL',
    7500,
    0,
  ),
];
