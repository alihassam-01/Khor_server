# TypeORM Migrations

The schema is managed with TypeORM migrations under
[`src/migrations/`](../src/migrations/). The TypeORM datasource lives in
[`src/config/ormconfig.ts`](../src/config/ormconfig.ts) and is what the
CLI uses (via the npm scripts below).

---

## Quick reference

```bash
npm run migration:run        # apply pending migrations
npm run migration:revert     # roll back the most recent one
npm run migration:show       # list status of every migration
npm run migration:generate -- src/migrations/<Name>
```

Under the hood, each script invokes the TypeORM CLI with the project
datasource:

```bash
npm run typeorm -- <typeorm-cli-subcommand> -d src/config/ormconfig.ts
```

---

## Current migration: `1900000000000-InitialSchema`

The project lives in a single fresh-schema migration. It:

1. Drops every legacy table that may exist on a partially-migrated
   development database (`hotels`, `restaurants`, `vendor`,
   `customer_profile`, `city`, `locality`, `media`, `hotel_review`,
   `restaurant_review`, etc.).
2. Drops and re-creates every enum type used by the new entities.
3. Creates the new schema centred on the unified `listings` model and
   the polymorphic `reviews` model. See
   [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) for the full table list.

Because the project is pre-launch we do not preserve historical
migrations; if you need to change the schema before the first
production deploy, prefer editing `InitialSchema` directly. Once we
ship, every further change must be a brand-new migration.

> **DON'T** edit `InitialSchema` after the first production run — write
> a new migration instead.

---

## Workflow for new schema changes (post-launch)

### 1. Edit the entity

```ts
// src/modules/user/entity/listing/hotel-details.entity.ts
@Column({ type: "text", nullable: true })
breakfast_policy?: string | null;
```

### 2. Generate a migration

```bash
npm run migration:generate -- src/migrations/AddHotelBreakfastPolicy
```

TypeORM compares the entity model with the live database and emits
`up()` / `down()` SQL. Review the generated file before committing —
the generator can occasionally pick up unrelated drift (e.g. an enum
ordering tweak); discard those bits.

### 3. Apply

```bash
npm run migration:run
```

### 4. If something is wrong

```bash
npm run migration:revert
```

…then fix the issue and regenerate.

---

## Manual migrations

If you need raw SQL (for an index, an extension, a generated column),
write a hand-rolled migration:

```ts
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddListingsSearchIndex1900000000010 implements MigrationInterface {
    public async up(qr: QueryRunner): Promise<void> {
        await qr.query(`
            CREATE INDEX IF NOT EXISTS gin_listings_search_vector
            ON listings USING gin(search_vector);
        `);
    }

    public async down(qr: QueryRunner): Promise<void> {
        await qr.query(`DROP INDEX IF EXISTS gin_listings_search_vector;`);
    }
}
```

Filename must be `<unix-millis>-<Name>.ts` so the runner orders them
deterministically.

---

## Best practices

1. **One logical change per migration.** Keep them small and
   reviewable.
2. **Always implement `down()`.** It's the only safety net during
   development.
3. **Never edit a migration after it has been applied to a shared
   database.** Write a new one.
4. **Test on a fresh database** (drop + run all migrations) before
   merging schema changes.
5. **Don't use `synchronize: true` in any environment.** The datasource
   has it disabled; keep it that way.

---

## Troubleshooting

### "No changes detected" when generating

- Check `src/config/ormconfig.ts` is finding all your entities (the
  glob is `src/modules/**/entity/**/*.entity.ts`).
- Make sure decorators (`@Entity`, `@Column`) are in place.
- Confirm the database is reachable and reflects the *previous*
  migration state (run `migration:run` first if needed).

### Migration ran on the wrong database

`ormconfig.ts` reads from `process.env`. Verify with:

```bash
node -e "require('dotenv').config(); console.log(process.env.DB_HOST, process.env.DB_NAME)"
```

### Resetting a dev database

Because `InitialSchema` already drops every legacy table, a clean reset
is just:

```bash
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
npm run migration:run
npm run seed:all   # optional
```

---

## Migrating data from the legacy (`main` branch) database

If you need to bring `location` and `articles` data over from an existing
`main`-branch deployment into the new schema, use the one-shot migration
script at [`src/scripts/migrate-legacy-data.ts`](../src/scripts/migrate-legacy-data.ts).

### What it copies

- `location_categories` (with `parent_category_id`)
- `location` (with `parent_location_id`)
- `location_attributes`
- `location_category_mapping`
- `tags`
- `articles` (full row including `image_urls` text[] and `fulltext_index`;
  `search_vector` is auto-rebuilt by the trigger)
- `article_locations`
- `article_tags`
- `article_category_mappings`
- `s3_images` — only entries whose `url` is referenced by some
  `article.image_urls` (so deleting a migrated article still cleans up
  R2 properly)

### What it intentionally skips

Users, vendors, addresses, hotels, restaurants, listings, reviews,
payments, analytics, and any author/vendor/user FK columns. The script
never touches the source database.

### Setup

The script needs **two** Postgres connections — the legacy DB (read-only
in practice) and the new DB. Either set connection URLs:

```bash
export SOURCE_DATABASE_URL="postgres://user:pass@old-host:5432/olddb"
export TARGET_DATABASE_URL="postgres://user:pass@new-host:5432/newdb"
```

…or split host/port/etc:

```bash
export SOURCE_DB_HOST=...   SOURCE_DB_PORT=5432
export SOURCE_DB_USERNAME=... SOURCE_DB_PASSWORD=... SOURCE_DB_NAME=...
export TARGET_DB_HOST=...   TARGET_DB_PORT=5432
export TARGET_DB_USERNAME=... TARGET_DB_PASSWORD=... TARGET_DB_NAME=...
```

### Run

```bash
# 1. Make sure the target schema is in place first.
npm run migration:run

# 2. Dry run — connects, counts rows, but rolls back.
npm run migrate:legacy -- --dry-run

# 3. Real run.
npm run migrate:legacy

# 4. Optional verbose chunk-level logging.
npm run migrate:legacy -- --verbose
```

### Behaviour

- Source primary keys are **preserved** so foreign keys between migrated
  rows stay intact. After the copy, all `SERIAL` sequences on the target
  are `setval`'d to `MAX(pk)` so future inserts don't collide.
- All inserts use `ON CONFLICT (<pk>) DO NOTHING`, so the script is
  **idempotent** — re-running it after a partial failure is safe.
- All target writes happen inside a single transaction. On any error
  (or with `--dry-run`) the transaction is rolled back; partial writes
  cannot be left behind.
- Self-referential tables (`location`, `location_categories`) are
  copied in `ORDER BY id ASC`, which is a valid topological order
  because a child's `SERIAL` id is always greater than its parent's.

### After the run

The summary printed at the end shows `read` / `inserted` per table.
A non-zero `read - inserted` means rows were skipped because the same
PK already existed in the target — usually expected on re-runs.

```
Summary
-------
table                            read   inserted
tags                              123        123
location_categories                42         42
location                          876        876
location_attributes               210        210
location_category_mapping         654        654
articles                          318        318
article_locations                 612        612
article_tags                      944        944
article_category_mappings         287        287
s3_images                         412        412
```

If anything fails the script aborts with a non-zero exit code and a
stack trace; nothing is committed.

---

## Production deployment checklist

```bash
npm install
npm run build
npm run migration:run
npm start
```

Run migrations as a separate step from app start. The deployment
pipeline should fail if `migration:run` fails — never auto-skip.
