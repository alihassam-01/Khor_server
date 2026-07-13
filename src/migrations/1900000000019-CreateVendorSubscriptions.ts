import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateVendorSubscriptions1900000000019 implements MigrationInterface {
    name = "CreateVendorSubscriptions1900000000019";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "vendor_subscriptions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "vendor_id" uuid NOT NULL,
                "plan_id" uuid,
                "subscription_type" "listing_subscriptions_subscription_type_enum" NOT NULL DEFAULT 'free',
                "status" "listing_subscriptions_status_enum" NOT NULL DEFAULT 'pending',
                "is_featured" boolean NOT NULL DEFAULT false,
                "amount" numeric(10,2) NOT NULL DEFAULT 0,
                "is_paid" boolean NOT NULL DEFAULT false,
                "payment_id" uuid,
                "started_at" TIMESTAMPTZ,
                "paid_at" TIMESTAMPTZ,
                "next_due_date" TIMESTAMPTZ,
                "grace_period_days" integer NOT NULL DEFAULT 7,
                "expires_at" TIMESTAMPTZ,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_vendor_subscriptions_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_vendor_subscriptions_vendor" FOREIGN KEY ("vendor_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_vendor_subscriptions_plan" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("plan_id") ON DELETE SET NULL ON UPDATE NO ACTION
            )
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS "IDX_vendor_subscriptions_vendor_id"
            ON "vendor_subscriptions" ("vendor_id")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_vendor_subscriptions_expires_at"
            ON "vendor_subscriptions" ("expires_at")
        `);

        await queryRunner.query(`
            INSERT INTO "vendor_subscriptions" (
                "vendor_id",
                "plan_id",
                "subscription_type",
                "status",
                "is_featured",
                "amount",
                "is_paid",
                "payment_id",
                "started_at",
                "paid_at",
                "next_due_date",
                "grace_period_days",
                "expires_at",
                "created_at",
                "updated_at"
            )
            SELECT
                ranked.vendor_id,
                ranked.plan_id,
                ranked.subscription_type,
                ranked.status,
                ranked.is_featured,
                ranked.amount,
                ranked.is_paid,
                ranked.payment_id,
                ranked.started_at,
                ranked.paid_at,
                ranked.next_due_date,
                ranked.grace_period_days,
                ranked.expires_at,
                ranked.created_at,
                ranked.updated_at
            FROM (
                SELECT
                    l.vendor_id,
                    ls.plan_id,
                    ls.subscription_type,
                    ls.status,
                    ls.is_featured,
                    ls.amount,
                    ls.is_paid,
                    ls.payment_id,
                    ls.started_at,
                    ls.paid_at,
                    ls.next_due_date,
                    ls.grace_period_days,
                    ls.expires_at,
                    ls.created_at,
                    ls.updated_at,
                    ROW_NUMBER() OVER (
                        PARTITION BY l.vendor_id
                        ORDER BY
                            CASE WHEN l.type = 'hotel' THEN 0 ELSE 1 END,
                            CASE
                                WHEN ls.status = 'active' THEN 0
                                WHEN ls.status = 'pending' THEN 1
                                ELSE 2
                            END,
                            CASE WHEN ls.is_paid THEN 0 ELSE 1 END,
                            COALESCE(ls.paid_at, ls.started_at, ls.created_at) DESC,
                            ls.created_at DESC
                    ) AS rn
                FROM "listing_subscriptions" ls
                INNER JOIN "listings" l ON l.id = ls.listing_id
                WHERE l.vendor_id IS NOT NULL
            ) ranked
            WHERE ranked.rn = 1
            ON CONFLICT ("vendor_id") DO NOTHING
        `);

        await queryRunner.query(`
            INSERT INTO "vendor_subscriptions" (
                "vendor_id",
                "subscription_type",
                "status",
                "is_featured",
                "amount",
                "is_paid",
                "started_at",
                "paid_at",
                "next_due_date",
                "grace_period_days",
                "expires_at"
            )
            SELECT
                l.vendor_id,
                'free'::"listing_subscriptions_subscription_type_enum",
                'active'::"listing_subscriptions_status_enum",
                false,
                0,
                true,
                now(),
                now(),
                NULL,
                7,
                NULL
            FROM "listings" l
            WHERE l.vendor_id IS NOT NULL
            GROUP BY l.vendor_id
            ON CONFLICT ("vendor_id") DO NOTHING
        `);

        await queryRunner.query(`
            ALTER TABLE "ad_payments"
            ADD COLUMN IF NOT EXISTS "vendor_subscription_id" uuid
        `);

        await queryRunner.query(`
            UPDATE "ad_payments" ap
            SET "vendor_subscription_id" = vs.id
            FROM "vendor_subscriptions" vs
            WHERE ap.vendor_id = vs.vendor_id
              AND ap.vendor_subscription_id IS NULL
        `);

        await queryRunner.query(`
            ALTER TABLE "ad_payments"
            ADD CONSTRAINT "FK_ad_payments_vendor_subscription"
            FOREIGN KEY ("vendor_subscription_id") REFERENCES "vendor_subscriptions"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "ad_payments"
            DROP CONSTRAINT IF EXISTS "FK_ad_payments_vendor_subscription"
        `);
        await queryRunner.query(`
            ALTER TABLE "ad_payments"
            DROP COLUMN IF EXISTS "vendor_subscription_id"
        `);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vendor_subscriptions_expires_at"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_vendor_subscriptions_vendor_id"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "vendor_subscriptions"`);
    }
}
