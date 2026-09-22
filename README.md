# Namou Shop — Backend

REST API for the Namou mini e-commerce platform: authentication, product catalogue, cart, wishlist and checkout.

The frontend lives in a separate repository ([namou-shop-frontend](https://github.com/alyawdi/namou-shop-frontend)).

## Stack

| Concern    | Choice                                         |
| ---------- | ---------------------------------------------- |
| Runtime    | Node.js 22, TypeScript (ESM)                   |
| HTTP       | Express 5                                      |
| Database   | SQLite (better-sqlite3) with Drizzle ORM       |
| Validation | Zod                                            |
| Auth       | Server-side sessions in an httpOnly cookie     |
| Logging    | pino                                           |
| Testing    | Vitest + Supertest against an in-memory SQLite |

## Getting started

Requires Node.js 22+.

```bash
npm install
cp .env.example .env
npm run db:reset   # creates data/shop.db, runs migrations, seeds products and the demo user
npm run dev        # http://localhost:4000
```

Demo login (configurable in `.env`):

- **Email:** `demo@namou.shop`
- **Password:** `Demo@12345`

## Scripts

| Script                | Purpose                                               |
| --------------------- | ----------------------------------------------------- |
| `npm run dev`         | Start the API with hot reload                         |
| `npm run build`       | Compile to `dist/`                                    |
| `npm start`           | Run the compiled build (applies pending migrations)   |
| `npm test`            | Run the test suite                                    |
| `npm run lint`        | ESLint                                                |
| `npm run typecheck`   | TypeScript without emitting                           |
| `npm run db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `npm run db:migrate`  | Apply migrations                                      |
| `npm run db:seed`     | Seed the demo user and catalogue (idempotent)         |
| `npm run db:reset`    | Delete the local database and rebuild it              |
| `npm run db:studio`   | Browse the database with Drizzle Studio               |

## Project layout

```
src/
  app.ts                 Express app: middleware, routers, error handling
  server.ts              Process entry: migrations, listen, graceful shutdown
  config/env.ts          Environment variables validated with Zod
  db/
    schema.ts            Tables, constraints, indexes and relations
    client.ts            SQLite connection and migration runner
    seeder.ts, seed.ts   Demo user and catalogue seed
    seed-data/           The 15 seed products
  middleware/            Session authentication, error and 404 handlers
  modules/<feature>/     *.routes.ts (HTTP + validation) and *.service.ts (business
                         rules + its own queries); products.queries.ts holds the
                         catalogue reads shared across modules
  lib/                   Errors, logger, password hashing, shared validators
drizzle/                 Generated SQL migrations (committed)
tests/                   API integration tests
```

## API

Base path: `/api/v1`. All request and response bodies are JSON. 🔒 = requires a session.

| Method | Path                                  | Description                                     |
| ------ | ------------------------------------- | ----------------------------------------------- |
| POST   | `/auth/login`                         | Log in; sets the session cookie                 |
| POST   | `/auth/logout`                        | Log out; destroys the session                   |
| GET    | `/auth/me` 🔒                         | Current user                                    |
| GET    | `/products`                           | All products (summary)                          |
| GET    | `/products/:slug`                     | Product detail with options, variants and stock |
| GET    | `/cart` 🔒                            | Cart with line totals and subtotal              |
| POST   | `/cart/items` 🔒                      | Add `{ variantId, quantity? }`                  |
| PATCH  | `/cart/items/:id` 🔒                  | Change `{ quantity?, variantId? }`              |
| DELETE | `/cart/items/:id` 🔒                  | Remove a line                                   |
| GET    | `/wishlist` 🔒                        | Wishlist                                        |
| POST   | `/wishlist/items` 🔒                  | Save `{ productId, variantId? }` (idempotent)   |
| DELETE | `/wishlist/items/:id` 🔒              | Remove                                          |
| POST   | `/wishlist/items/:id/move-to-cart` 🔒 | Move to cart `{ variantId? }`                   |
| GET    | `/orders` 🔒                          | Order history                                   |
| POST   | `/orders` 🔒                          | Place an order from the cart                    |
| GET    | `/orders/:reference` 🔒               | Order confirmation / detail                     |
| GET    | `/health`                             | Liveness check (outside `/api/v1`)              |

Cart and wishlist mutations return the updated resource so clients can replace their cached state in one step.

### Errors

Every error uses the same shape:

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Only 3 left in stock",
    "details": { "available": 3 }
  }
}
```

| Status | Codes                                                                               |
| ------ | ----------------------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`, `INVALID_JSON`, `CART_EMPTY`, `VARIANT_REQUIRED`, `BAD_REQUEST` |
| 401    | `UNAUTHORIZED`, `INVALID_CREDENTIALS`                                               |
| 404    | `NOT_FOUND`, `ROUTE_NOT_FOUND`                                                      |
| 409    | `INSUFFICIENT_STOCK`                                                                |
| 429    | `TOO_MANY_REQUESTS` (login rate limit)                                              |

## Documentation

- [Image credits](docs/IMAGE_CREDITS.md)
- [Database](docs/DATABASE.md)
- [Backend](docs/BACKEND.md)
- [AI usage](docs/AI_USAGE.md)
