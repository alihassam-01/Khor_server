import { MigrationInterface, QueryRunner } from "typeorm";

export class AddListingSubscriptionBillingDates1900000000009 implements MigrationInterface {
    name = "AddListingSubscriptionBillingDates1900000000009";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "listing_subscriptions"
            ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "next_due_date" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "grace_period_days" int NOT NULL DEFAULT 7
        `);

        await queryRunner.query(`
            UPDATE "listing_subscriptions"
            SET
                "paid_at" = COALESCE("paid_at", "started_at"),
                "next_due_date" = COALESCE("next_due_date", "expires_at"),
                "grace_period_days" = COALESCE("grace_period_days", 7)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "listing_subscriptions"
            DROP COLUMN IF EXISTS "grace_period_days",
            DROP COLUMN IF EXISTS "next_due_date",
            DROP COLUMN IF EXISTS "paid_at"
        `);
    }
}
