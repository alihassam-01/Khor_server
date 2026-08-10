# Khor-server

Backend for the Travel Baltistan platform: users, listings (hotels,
restaurants, future tours/vehicles), reviews, subscriptions, payments,
articles, and locations. TypeScript on Fastify + TypeORM + PostgreSQL.

> 📚 **API documentation:** [`docs/API_DOC.md`](./docs/API_DOC.md).
> For architecture and implementation details, see the documentation index
> below and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

---

## Quickstart

### Prerequisites

- Node.js ≥ 23 (the runner uses `node:test`)
- PostgreSQL with `uuid-ossp` and `pgcrypto` extensions available
- An R2 (S3-compatible) bucket for media — see env config

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# fill in DB_*, distinct 32+ character JWT_SECRET/JWT_RESET_SECRET, R2_*, EMAIL_*, etc.

# 3. Apply schema
npm run migration:run

# 4. (Optional) seed locations + articles
npm run seed:all

# 5. Run
npm run dev      # ts-node + nodemon
# or
npm run build && npm start
```

### Tests

```bash
npm test
```

Runs `node:test` against `tests/**/*.test.ts`. See
[`docs/TESTING.md`](./docs/TESTING.md) for details.

### WhatsApp notification worker

Booking WhatsApp messages use a PostgreSQL outbox and a separate OpenClaw
adapter. API processes should use `PROCESS_ROLE=api`; run one or more workers
with:

```bash
PROCESS_ROLE=worker npm run start:worker
```

Required rollout configuration:

```dotenv
WHATSAPP_NOTIFICATIONS_ENABLED=false
WHATSAPP_BOOKING_LIFECYCLE_ENABLED=false
WHATSAPP_OWNER_CHECKIN_DIGEST_ENABLED=false
WHATSAPP_ADAPTER_URL=http://127.0.0.1:3000
WHATSAPP_ADAPTER_TOKEN=
WHATSAPP_ADAPTER_TIMEOUT_MS=15000
NOTIFICATION_TIMEZONE=Asia/Karachi
NOTIFICATION_WORKER_BATCH_SIZE=20
NOTIFICATION_WORKER_MAX_ATTEMPTS=5
```

Apply migrations before enabling the flags. Keep the adapter on localhost or a
private network.

### Type-checking

```bash
npx tsc --noEmit                            # production sources
npx tsc --noEmit -p tests/tsconfig.json     # tests
```

---

## What's in here

```
src/
  app/                Fastify bootstrap + plugins
  common/             enums, errors, constants, utils
  config/             env, datasource, logger
  middlewares/        auth, RBAC, error handler
  migrations/         TypeORM migrations
  modules/user/
    controller/       thin HTTP adapters
    dtos/             request/response shapes
    entity/           TypeORM entities
    routes/           Fastify route registrations
    service/
      listing/          unified ListingService + strategies (hotel, restaurant)
      ...               auth, user, ads, payments, analytics, email, ...
tests/                node:test specs
docs/                 markdown documentation (start here)
```

### Architectural highlights

- **One `listings` table.** Hotels, restaurants, tours, vehicles all
  live in a single polymorphic entity with per-type 1:1 extension
  tables (`hotel_details`, `restaurant_details`).
- **Strategy pattern.** `ListingService` is generic; per-type behavior
  lives in small `IListingStrategy` classes
  (`HotelStrategy`, `RestaurantStrategy`).
- **Unified reviews.** A single `reviews` table targets any reviewable
  entity by `(target_type, target_id)`.
- **Unified user profile.** `user_profiles` replaces the old
  `vendors` / `customer_profiles` split.
- **Subscription history.** `listing_subscriptions` keeps one row per
  period; `ad_payments` links to the period it paid for.
- **Media as data.** `listing_media` rows carry a role
  (`cover|logo|gallery|menu|room`) plus an optional FK into the
  `s3_images` registry for hard-deletion.

See [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) for the full
picture and [`docs/DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md) for
the column-level reference.

---

## Useful npm scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | ts-node + nodemon, watches `src/`. |
| `npm run build` | Clean, run `tsc`, then `tsc-alias` to flatten paths. |
| `npm start` | Run the compiled server. |
| `npm test` | Run unit tests. |
| `npm run migration:run` | Apply pending migrations. |
| `npm run migration:revert` | Roll back the most recent migration. |
| `npm run migration:show` | Show migration status. |
| `npm run migration:generate -- src/migrations/<Name>` | Generate a new migration from entity changes. |
| `npm run seed:locations` | Seed the locations table. |
| `npm run seed:articles` | Seed the articles table. |
| `npm run seed:all` | Run both seeds. |

---

## Documentation index

| Doc | What's inside |
| --- | --- |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) | High-level architecture (start here). |
| [`docs/DATABASE_SCHEMA.md`](./docs/DATABASE_SCHEMA.md) | Column-by-column schema reference. |
| [`docs/API_DOC.md`](./docs/API_DOC.md) | REST API surface. |
| [`docs/ad_routes.md`](./docs/ad_routes.md) | Hotel/restaurant ad workflow + payments. |
| [`docs/SEARCH_API.md`](./docs/SEARCH_API.md) | Fulltext search behavior. |
| [`docs/ARTICLE_API_USAGE.md`](./docs/ARTICLE_API_USAGE.md) | JSON-only article workflow. |
| [`docs/MIGRATIONS.md`](./docs/MIGRATIONS.md) | Migration workflow. |
| [`docs/TESTING.md`](./docs/TESTING.md) | Tests, coverage, how to add new ones. |
| [`docs/CODEBASE_ISSUES_AND_SUGGESTIONS.md`](./docs/CODEBASE_ISSUES_AND_SUGGESTIONS.md) | Known issues + accepted improvements. |

---

## Contributing

1. Branch off `main`.
2. Update or add tests for behavior changes.
3. Make sure `npx tsc --noEmit`, `npx tsc --noEmit -p tests/tsconfig.json`,
   and `npm test` all pass.
4. Update the relevant doc in `docs/` if you touched architecture, the
   API surface, or the database schema.
