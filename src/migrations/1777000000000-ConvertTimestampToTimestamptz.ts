import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * ConvertTimestampToTimestamptz
 *
 * Converts all TIMESTAMP WITHOUT TIME ZONE columns to TIMESTAMP WITH TIME ZONE
 * (timestamptz) across every table in the schema.
 *
 * Also adds the missing `updatedAt` column to the `user` table so it now
 * matches every other entity in the codebase.
 *
 * PostgreSQL stores timestamptz values in UTC internally and converts them to
 * the session timezone on retrieval. By keeping the server timezone at UTC and
 * using timestamptz, all stored dates are unambiguous regardless of where the
 * server runs.
 *
 * The migration is safe to re-run: ALTER COLUMN ... TYPE is idempotent when
 * the column is already timestamptz (Postgres silently accepts it).
 */
export class ConvertTimestampToTimestamptz1777000000000 implements MigrationInterface {
    name = "ConvertTimestampToTimestamptz1777000000000";

    public async up(queryRunner: QueryRunner): Promise<void> {

        // ── user ──────────────────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "user"
                ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ USING "createdAt" AT TIME ZONE 'UTC'
        `);

        await queryRunner.query(`
            ALTER TABLE "user"
                ALTER COLUMN "otpExpiresAt" TYPE TIMESTAMPTZ USING "otpExpiresAt" AT TIME ZONE 'UTC'
        `);

        // Add updatedAt to user table (did not exist before)
        await queryRunner.query(`
            ALTER TABLE "user"
                ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
        `);

        // ── hotels ────────────────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "hotels"
                ALTER COLUMN "created_at" TYPE TIMESTAMPTZ USING "created_at" AT TIME ZONE 'UTC',
                ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ USING "updated_at" AT TIME ZONE 'UTC'
        `);

        await queryRunner.query(`
            ALTER TABLE "hotels"
                ALTER COLUMN "expires_at" TYPE TIMESTAMPTZ USING "expires_at" AT TIME ZONE 'UTC'
        `);

        // ── hotel_reviews ─────────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "hotel_reviews"
                ALTER COLUMN "date" TYPE TIMESTAMPTZ USING "date" AT TIME ZONE 'UTC'
        `);

        // ── restaurant_reviews ────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "restaurant_reviews"
                ALTER COLUMN "date" TYPE TIMESTAMPTZ USING "date" AT TIME ZONE 'UTC'
        `);

        // ── hotel_room_types ──────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "hotel_room_types"
                ALTER COLUMN "created_at" TYPE TIMESTAMPTZ USING "created_at" AT TIME ZONE 'UTC',
                ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ USING "updated_at" AT TIME ZONE 'UTC'
        `);

        // ── restaurants ───────────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "restaurants"
                ALTER COLUMN "created_at" TYPE TIMESTAMPTZ USING "created_at" AT TIME ZONE 'UTC',
                ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ USING "updated_at" AT TIME ZONE 'UTC'
        `);

        await queryRunner.query(`
            ALTER TABLE "restaurants"
                ALTER COLUMN "expires_at" TYPE TIMESTAMPTZ USING "expires_at" AT TIME ZONE 'UTC'
        `);

        // ── ad_payments ───────────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "ad_payments"
                ALTER COLUMN "created_at" TYPE TIMESTAMPTZ USING "created_at" AT TIME ZONE 'UTC',
                ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ USING "updated_at" AT TIME ZONE 'UTC'
        `);

        // ── ad_analytics ──────────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "ad_analytics"
                ALTER COLUMN "created_at" TYPE TIMESTAMPTZ USING "created_at" AT TIME ZONE 'UTC'
        `);

        // ── audit_logs ────────────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "audit_logs"
                ALTER COLUMN "created_at" TYPE TIMESTAMPTZ USING "created_at" AT TIME ZONE 'UTC'
        `);

        // ── articles ──────────────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "articles"
                ALTER COLUMN "created_at" TYPE TIMESTAMPTZ USING "created_at" AT TIME ZONE 'UTC',
                ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ USING "updated_at" AT TIME ZONE 'UTC'
        `);

        await queryRunner.query(`
            ALTER TABLE "articles"
                ALTER COLUMN "published_at" TYPE TIMESTAMPTZ USING "published_at" AT TIME ZONE 'UTC'
        `);

        // ── subscription_plans ────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "subscription_plans"
                ALTER COLUMN "created_at" TYPE TIMESTAMPTZ USING "created_at" AT TIME ZONE 'UTC',
                ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ USING "updated_at" AT TIME ZONE 'UTC'
        `);

        // ── payment_settings ──────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "payment_settings"
                ALTER COLUMN "created_at" TYPE TIMESTAMPTZ USING "created_at" AT TIME ZONE 'UTC',
                ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ USING "updated_at" AT TIME ZONE 'UTC'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {

        // ── payment_settings ──────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "payment_settings"
                ALTER COLUMN "created_at" TYPE TIMESTAMP USING "created_at" AT TIME ZONE 'UTC',
                ALTER COLUMN "updated_at" TYPE TIMESTAMP USING "updated_at" AT TIME ZONE 'UTC'
        `);

        // ── subscription_plans ────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "subscription_plans"
                ALTER COLUMN "created_at" TYPE TIMESTAMP USING "created_at" AT TIME ZONE 'UTC',
                ALTER COLUMN "updated_at" TYPE TIMESTAMP USING "updated_at" AT TIME ZONE 'UTC'
        `);

        // ── articles ──────────────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "articles"
                ALTER COLUMN "published_at" TYPE TIMESTAMP USING "published_at" AT TIME ZONE 'UTC'
        `);

        await queryRunner.query(`
            ALTER TABLE "articles"
                ALTER COLUMN "created_at" TYPE TIMESTAMP USING "created_at" AT TIME ZONE 'UTC',
                ALTER COLUMN "updated_at" TYPE TIMESTAMP USING "updated_at" AT TIME ZONE 'UTC'
        `);

        // ── audit_logs ────────────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "audit_logs"
                ALTER COLUMN "created_at" TYPE TIMESTAMP USING "created_at" AT TIME ZONE 'UTC'
        `);

        // ── ad_analytics ──────────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "ad_analytics"
                ALTER COLUMN "created_at" TYPE TIMESTAMP USING "created_at" AT TIME ZONE 'UTC'
        `);

        // ── ad_payments ───────────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "ad_payments"
                ALTER COLUMN "created_at" TYPE TIMESTAMP USING "created_at" AT TIME ZONE 'UTC',
                ALTER COLUMN "updated_at" TYPE TIMESTAMP USING "updated_at" AT TIME ZONE 'UTC'
        `);

        // ── restaurants ───────────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "restaurants"
                ALTER COLUMN "expires_at" TYPE TIMESTAMP USING "expires_at" AT TIME ZONE 'UTC'
        `);

        await queryRunner.query(`
            ALTER TABLE "restaurants"
                ALTER COLUMN "created_at" TYPE TIMESTAMP USING "created_at" AT TIME ZONE 'UTC',
                ALTER COLUMN "updated_at" TYPE TIMESTAMP USING "updated_at" AT TIME ZONE 'UTC'
        `);

        // ── hotel_room_types ──────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "hotel_room_types"
                ALTER COLUMN "created_at" TYPE TIMESTAMP USING "created_at" AT TIME ZONE 'UTC',
                ALTER COLUMN "updated_at" TYPE TIMESTAMP USING "updated_at" AT TIME ZONE 'UTC'
        `);

        // ── hotel_reviews ─────────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "hotel_reviews"
                ALTER COLUMN "date" TYPE TIMESTAMP USING "date" AT TIME ZONE 'UTC'
        `);

        // ── restaurant_reviews ────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "restaurant_reviews"
                ALTER COLUMN "date" TYPE TIMESTAMP USING "date" AT TIME ZONE 'UTC'
        `);

        // ── hotels ────────────────────────────────────────────────────────────
        await queryRunner.query(`
            ALTER TABLE "hotels"
                ALTER COLUMN "expires_at" TYPE TIMESTAMP USING "expires_at" AT TIME ZONE 'UTC'
        `);

        await queryRunner.query(`
            ALTER TABLE "hotels"
                ALTER COLUMN "created_at" TYPE TIMESTAMP USING "created_at" AT TIME ZONE 'UTC',
                ALTER COLUMN "updated_at" TYPE TIMESTAMP USING "updated_at" AT TIME ZONE 'UTC'
        `);

        // ── user ──────────────────────────────────────────────────────────────
        // Remove the updatedAt column that was added in up()
        await queryRunner.query(`ALTER TABLE "user" DROP COLUMN IF EXISTS "updatedAt"`);

        await queryRunner.query(`
            ALTER TABLE "user"
                ALTER COLUMN "otpExpiresAt" TYPE TIMESTAMP USING "otpExpiresAt" AT TIME ZONE 'UTC'
        `);

        await queryRunner.query(`
            ALTER TABLE "user"
                ALTER COLUMN "createdAt" TYPE TIMESTAMP USING "createdAt" AT TIME ZONE 'UTC'
        `);
    }
}
