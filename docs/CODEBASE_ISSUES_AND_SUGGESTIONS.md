# Codebase Issues and Suggestions

A standing list of known issues and accepted improvements. Items are
grouped into:

- **Resolved** — implemented during the April 2026 unification refactor.
- **Open (high)** — security / correctness; address before launch.
- **Open (medium)** — stability / maintainability.
- **Open (low)** — DX / performance niceties.

---

## Resolved (April 2026 unification refactor)

These items, on previous versions of this document, are now done.

### ✅ Hotel/restaurant duplication

Two near-identical entity trees (`hotel`, `hotel_review`, `room_type`
and the matching `restaurant_*` siblings) collapsed into one
`listings` table + per-type extension entities (`hotel_details`,
`restaurant_details`) and a polymorphic `reviews` table.

### ✅ Vendor / customer-profile split

`vendors` and `customer_profiles` were structurally identical. Merged
into `user_profiles`; the role distinction now lives on `user.userType`.

### ✅ Per-type service layers

`HotelService` and `RestaurantService` had ~80% duplicated logic. They
now delegate to `ListingService` + a per-type `IListingStrategy`. New
listing types (tour, vehicle) only need a strategy.

### ✅ Subscription / payment fields scattered on entities

`subscription_type`, `expires_at`, `is_paid`, `is_featured`, `plan_id`
used to live on each ad entity. Moved to `listing_subscriptions` (one
row per period; renewal history is preserved).

### ✅ Media handling

- `r2client.service.uploadFileToR2` now returns
  `{ url, key, s3_image_id }` so callers can link directly to the
  `s3_images` registry.
- Deduplication by MD5 hash means re-uploading the same file returns
  the existing URL.
- `ListingMediaService.syncMedia` does a clean `(role, url)` diff,
  dedupes inputs, and defaults `display_order` to the input array
  index. Replaces the old per-field columns.

### ✅ Polymorphic review duplication

`hotel_reviews` and `restaurant_reviews` are gone. One `reviews` table
keyed by `(target_type, target_id)` covers listings, room types,
articles, and locations.

### ✅ Rating recompute correctness

`Listing.rating_avg` / `rating_count` are now maintained transactionally
by `ReviewService` whenever a review is created/updated/deleted/
moderated. No more drift between the source-of-truth row and the
denormalized counter.

### ✅ Migration sprawl

The legacy chain of incremental migrations was replaced with a single
fresh-schema migration (`1900000000000-InitialSchema`) that drops
legacy tables and rebuilds the new schema. Pre-launch only — once
shipped, future changes are normal incremental migrations.

### ✅ Test infrastructure

Added a `tests/` tree using Node's built-in `node:test`. Initial unit
coverage for the listing strategies, media service, and subscription
service. See [`TESTING.md`](./TESTING.md).

### ✅ Stale folder/file cleanup

Removed empty `entity/ENUM`, `entity/ads`, `entity/business`,
`entity/media` directories along with all the old `Hotel`,
`Restaurant`, `Vendor`, `CustomerProfile`, `City`, `Locality`,
`Media`, and review entities.

---

## Open (high)

### JWT secret / config

- **Where**: `src/modules/user/service/auth.service.ts`,
  `src/config/config.ts`.
- **Issue**: Some places read `process.env.JWT_SECRET` directly while
  others read `config.jwt.secret`; insecure defaults still exist for
  dev convenience.
- **Fix**: Centralize on `config.jwt.secret`, fail fast at startup
  when the env var is missing in production, drop hard-coded fallbacks.

### Bcrypt rounds hard-coded

- **Where**: `auth.service.ts` (`bcrypt.hash(..., 10)`).
- **Fix**: Move to `config.security.bcryptRounds`, default 12.

### Email side-effects without error handling

- **Where**: `auth.service.ts`, `user.service.ts`.
- **Issue**: User registration commits even if OTP email fails to
  send.
- **Fix**: Wrap `SendEmail.send` in try/catch; if it fails, surface a
  toast-friendly error and either retry or mark the account so a
  subsequent `/auth/resend-otp` covers the gap.

### Rate limiting

- No `@fastify/rate-limit` configured. Public endpoints (`/auth/*`,
  `/contact`, search) should have it.

---

## Open (medium)

### Inconsistent error handling

- Mixed use of `throw new Error("...")`, `throw new AppError(...)`,
  and (in a couple of places) `throw new Error(JSON.stringify({...}))`.
- **Fix**: Standardize on `AppError` + `ErrorCodes` everywhere; remove
  any stringified-JSON `Error` constructions.

### `any` in update DTOs

- `IUpdateHotelDTO | any` and `IUpdateRestaurantDTO | any` in
  `hotel.routes.ts` / `restaurant.routes.ts`.
- **Fix**: Drop the `| any` once schemas are wired up; lean on
  `class-validator` or Fastify schemas for runtime validation.

### Repository instantiation timing

- Several services build `AppDataSource.getRepository(...)` as class
  fields, which assumes the datasource is initialized at import time.
- **Fix**: Lazy getter pattern or constructor injection. (Currently
  works because `AppDataSource.initialize()` runs before any service
  is constructed in `index.ts`, but it's fragile.)

### `IVendorProfileDTO` / `ICustomerProfileDTO` divergence

- These DTOs still have separate definitions even though the underlying
  entity is unified.
- **Fix**: Collapse to a single `IUserProfileDTO`; keep aliases for
  backward compatibility during the transition.

### Pagination on list endpoints

- `GET /users`, `GET /vendors`, `GET /customers` return everything.
- **Fix**: Add `page` / `limit` (Listings already have them).

### Soft-delete handling

- Only `Listing` is soft-deletable. Most queries on listings need
  `withDeleted: false` (the default), but a couple of admin endpoints
  hand-roll their own filters.
- **Fix**: Audit the admin queries for accidental inclusion of
  soft-deleted rows.

---

## Open (low)

### Structured logging

- `lib/logger` is custom and minimal. Move to `pino` (already a
  fastify-friendly choice) with request-id correlation.

### Caching for hot reads

- Public `GET /hotels`, `GET /restaurants`, `GET /subscription-plans`
  could benefit from a tiny in-memory cache or a Redis layer.

### OpenAPI doc generation

- We have hand-rolled markdown for the API. Wiring up
  `@fastify/swagger` with our existing TypeBox schemas would give us
  free, always-up-to-date interactive docs.

### CI

- No GitHub Actions workflow runs `npm test` and `tsc --noEmit` on
  every PR. Add one. (Skeleton exists in `.github/`.)

### Entity-glob configuration

- `ormconfig.ts` uses `src/modules/**/entity/**/*.entity.ts`. This
  works but is fragile; a typed barrel file (already exists at
  `src/modules/user/entity/index.ts`) is more refactor-resilient.
  Decide on one source of truth.
