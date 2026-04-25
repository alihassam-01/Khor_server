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

## Production deployment checklist

```bash
npm install
npm run build
npm run migration:run
npm start
```

Run migrations as a separate step from app start. The deployment
pipeline should fail if `migration:run` fails — never auto-skip.
