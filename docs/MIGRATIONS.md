# TypeORM Migration Guide

## Overview

This project uses TypeORM migrations to manage database schema changes. Migrations are automatically generated based on entity changes.

---

## Quick Commands

### Generate Migration
Automatically creates a migration file based on entity changes:
```bash
npm run migration:generate -- src/migrations/MigrationName
```

**Example:**
```bash
npm run migration:generate -- src/migrations/AddAdManagementFields
```

### Run Migrations
Apply pending migrations to the database:
```bash
npm run migration:run
```

### Revert Migration
Undo the last migration:
```bash
npm run migration:revert
```

### Show Migrations
List all migrations and their status:
```bash
npm run migration:show
```

---

## Workflow

### 1. Make Entity Changes

Edit your entity files (e.g., add new fields):

```typescript
// src/modules/user/entity/ads/hotel.entity.ts
@Column("uuid", { nullable: true })
vendor_id?: string;

@Column("timestamp", { nullable: true })
expires_at?: Date;
```

### 2. Generate Migration

Run the generate command:
```bash
npm run migration:generate -- src/migrations/AddVendorFields
```

This will:
- Compare current entities with database schema
- Create a migration file in `src/migrations/`
- Include both `up()` and `down()` methods

### 3. Review Generated Migration

Check the generated file:
```typescript
// src/migrations/1737194567890-AddVendorFields.ts
export class AddVendorFields1737194567890 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // SQL to add columns
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // SQL to remove columns
    }
}
```

### 4. Run Migration

Apply the migration:
```bash
npm run migration:run
```

### 5. If Needed, Revert

Undo the last migration:
```bash
npm run migration:revert
```

---

## Current Migrations

### 1. AddAdManagementFields
- Adds vendor tracking to hotels/restaurants
- Adds subscription and expiration fields
- Creates ad_payments table

### 2. CreateSubscriptionPlansTable
- Creates subscription_plans table
- Stores dynamic subscription plans

---

## Best Practices

1. **Always review generated migrations** before running them
2. **Test migrations** on development database first
3. **Never edit migrations** after they've been run in production
4. **Keep migrations small** - one logical change per migration
5. **Use descriptive names** for migrations

---

## Troubleshooting

### Migration Already Exists
If you get "migration already exists" error:
```bash
# Delete the migration file and regenerate
rm src/migrations/1737194567890-MigrationName.ts
npm run migration:generate -- src/migrations/MigrationName
```

### No Changes Detected
If no migration is generated:
- Ensure entities are properly imported in ormconfig.ts
- Check that entity decorators are correct
- Verify database connection

### Migration Failed
If migration fails:
```bash
# Revert the failed migration
npm run migration:revert

# Fix the issue
# Regenerate migration
npm run migration:generate -- src/migrations/FixedMigration
```

---

## Manual Migrations

If you need to write a migration manually:

1. Create file: `src/migrations/TIMESTAMP-MigrationName.ts`
2. Implement MigrationInterface:

```typescript
import { MigrationInterface, QueryRunner } from "typeorm";

export class CustomMigration1737194567890 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            -- Your SQL here
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            -- Reverse SQL here
        `);
    }
}
```

---

## Production Deployment

1. Build the project: `npm run build`
2. Run migrations: `npm run migration:run`
3. Start the server: `npm start`

**Note:** Migrations run automatically in production if configured in deployment pipeline.
