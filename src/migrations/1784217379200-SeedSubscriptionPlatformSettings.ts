import { MigrationInterface, QueryRunner } from "typeorm";

export class SeedSubscriptionPlatformSettings1784217379200 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            INSERT INTO "platform_settings" ("setting_key", "setting_value") 
            VALUES 
                ('subscription_monthly_fee', '2500'),
                ('commission_rate_monthly', '0.10'),
                ('commission_rate_free', '0.15')
            ON CONFLICT ("setting_key") DO NOTHING;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM "platform_settings" 
            WHERE "setting_key" IN ('subscription_monthly_fee', 'commission_rate_monthly', 'commission_rate_free');
        `);
    }
}
