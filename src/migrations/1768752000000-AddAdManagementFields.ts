import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAdManagementFields1768752000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Ensure enum types exist for idempotent reruns.
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hotels_subscription_type_enum') THEN
                    CREATE TYPE "public"."hotels_subscription_type_enum" AS ENUM('free', 'monthly', 'quarterly', 'yearly');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'restaurants_subscription_type_enum') THEN
                    CREATE TYPE "public"."restaurants_subscription_type_enum" AS ENUM('free', 'monthly', 'quarterly', 'yearly');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ad_payments_ad_type_enum') THEN
                    CREATE TYPE "public"."ad_payments_ad_type_enum" AS ENUM('hotel', 'restaurant');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ad_payments_payment_status_enum') THEN
                    CREATE TYPE "public"."ad_payments_payment_status_enum" AS ENUM('pending', 'completed', 'failed', 'refunded');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ad_payments_payment_method_enum') THEN
                    CREATE TYPE "public"."ad_payments_payment_method_enum" AS ENUM('cash', 'bank_transfer', 'easypaisa', 'jazzcash', 'credit_card', 'debit_card');
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "vendor_id" uuid`);
        await queryRunner.query(`ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "expires_at" timestamp`);
        await queryRunner.query(`ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "subscription_type" "public"."hotels_subscription_type_enum" NOT NULL DEFAULT 'free'`);
        await queryRunner.query(`ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "is_paid" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "is_featured" boolean NOT NULL DEFAULT false`);

        await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "vendor_id" uuid`);
        await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "expires_at" timestamp`);
        await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "subscription_type" "public"."restaurants_subscription_type_enum" NOT NULL DEFAULT 'free'`);
        await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "is_paid" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "is_featured" boolean NOT NULL DEFAULT false`);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "ad_payments" (
                "payment_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "ad_id" uuid NOT NULL,
                "ad_type" "public"."ad_payments_ad_type_enum" NOT NULL,
                "vendor_id" uuid NOT NULL,
                "amount" numeric(10,2) NOT NULL,
                "payment_status" "public"."ad_payments_payment_status_enum" NOT NULL DEFAULT 'pending',
                "payment_method" "public"."ad_payments_payment_method_enum",
                "transaction_id" character varying(255),
                "notes" text,
                "receipt_url" character varying(255),
                "created_at" timestamp NOT NULL DEFAULT now(),
                "updated_at" timestamp NOT NULL DEFAULT now(),
                CONSTRAINT "PK_ad_payments_payment_id" PRIMARY KEY ("payment_id")
            )
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_hotels_vendor_id_users_id') THEN
                    ALTER TABLE "hotels"
                    ADD CONSTRAINT "FK_hotels_vendor_id_users_id"
                    FOREIGN KEY ("vendor_id") REFERENCES "user"("id") ON DELETE SET NULL;
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_restaurants_vendor_id_users_id') THEN
                    ALTER TABLE "restaurants"
                    ADD CONSTRAINT "FK_restaurants_vendor_id_users_id"
                    FOREIGN KEY ("vendor_id") REFERENCES "user"("id") ON DELETE SET NULL;
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_ad_payments_vendor_id_users_id') THEN
                    ALTER TABLE "ad_payments"
                    ADD CONSTRAINT "FK_ad_payments_vendor_id_users_id"
                    FOREIGN KEY ("vendor_id") REFERENCES "user"("id") ON DELETE CASCADE;
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_hotels_vendor_id" ON "hotels" ("vendor_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_hotels_expires_at" ON "hotels" ("expires_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_hotels_is_featured" ON "hotels" ("is_featured")`);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_restaurants_vendor_id" ON "restaurants" ("vendor_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_restaurants_expires_at" ON "restaurants" ("expires_at")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_restaurants_is_featured" ON "restaurants" ("is_featured")`);

        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ad_payments_vendor_id" ON "ad_payments" ("vendor_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ad_payments_ad_id" ON "ad_payments" ("ad_id")`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_ad_payments_status" ON "ad_payments" ("payment_status")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ad_payments_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ad_payments_ad_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ad_payments_vendor_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_restaurants_is_featured"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_restaurants_expires_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_restaurants_vendor_id"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hotels_is_featured"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hotels_expires_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hotels_vendor_id"`);

        await queryRunner.query(`ALTER TABLE "hotels" DROP CONSTRAINT IF EXISTS "FK_hotels_vendor_id_users_id"`);
        await queryRunner.query(`ALTER TABLE "restaurants" DROP CONSTRAINT IF EXISTS "FK_restaurants_vendor_id_users_id"`);
        await queryRunner.query(`ALTER TABLE "ad_payments" DROP CONSTRAINT IF EXISTS "FK_ad_payments_vendor_id_users_id"`);

        await queryRunner.query(`DROP TABLE IF EXISTS "ad_payments"`);

        await queryRunner.query(`ALTER TABLE "hotels" DROP COLUMN IF EXISTS "vendor_id"`);
        await queryRunner.query(`ALTER TABLE "hotels" DROP COLUMN IF EXISTS "expires_at"`);
        await queryRunner.query(`ALTER TABLE "hotels" DROP COLUMN IF EXISTS "subscription_type"`);
        await queryRunner.query(`ALTER TABLE "hotels" DROP COLUMN IF EXISTS "is_paid"`);
        await queryRunner.query(`ALTER TABLE "hotels" DROP COLUMN IF EXISTS "is_featured"`);

        await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "vendor_id"`);
        await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "expires_at"`);
        await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "subscription_type"`);
        await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "is_paid"`);
        await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN IF EXISTS "is_featured"`);
    }
}
