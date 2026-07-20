import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateVendorSubscriptionDefaultToMonthly1784552163200 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Change default value of the column
        await queryRunner.query(`ALTER TABLE "vendor_subscriptions" ALTER COLUMN "subscription_type" SET DEFAULT 'monthly'`);
        
        // Update existing free subscriptions to monthly
        await queryRunner.query(`
            UPDATE "vendor_subscriptions"
            SET "subscription_type" = 'monthly'
            WHERE "subscription_type" = 'free'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vendor_subscriptions" ALTER COLUMN "subscription_type" SET DEFAULT 'free'`);
    }

}
