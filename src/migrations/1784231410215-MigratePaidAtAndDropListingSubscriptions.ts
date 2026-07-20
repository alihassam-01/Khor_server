import { MigrationInterface, QueryRunner } from "typeorm";

export class MigratePaidAtAndDropListingSubscriptions1784231410215 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            UPDATE vendor_subscriptions
            SET paid_at = (
                SELECT MAX(ls.paid_at)
                FROM listing_subscriptions ls
                JOIN listings l ON ls.listing_id = l.id
                WHERE l.vendor_id = vendor_subscriptions.vendor_id
            )
            WHERE vendor_id IN (
                SELECT DISTINCT l.vendor_id
                FROM listing_subscriptions ls
                JOIN listings l ON ls.listing_id = l.id
                WHERE ls.paid_at IS NOT NULL
            );
        `);

        // Drop constraints from ad_payments referencing listing_subscriptions
        await queryRunner.query(`ALTER TABLE "ad_payments" DROP CONSTRAINT IF EXISTS "FK_99965cc23fbe20d14b0b954415c"`);
        await queryRunner.query(`ALTER TABLE "ad_payments" DROP CONSTRAINT IF EXISTS "fk_ad_payments_sub"`);

        await queryRunner.query(`DROP TABLE "listing_subscriptions" CASCADE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "listing_subscriptions" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "listing_id" uuid NOT NULL,
                "subscription_type" character varying NOT NULL DEFAULT 'free',
                "status" character varying NOT NULL DEFAULT 'pending',
                "amount" integer NOT NULL DEFAULT 0,
                "paid_at" TIMESTAMP,
                "started_at" TIMESTAMP,
                "expires_at" TIMESTAMP,
                "is_featured" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_listing_subscriptions_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_listing_subscriptions_listing_id" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_listing_subscriptions_expires_at" ON "listing_subscriptions" ("expires_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_listing_subscriptions_listing_id_status" ON "listing_subscriptions" ("listing_id", "status") `);
    }
}
