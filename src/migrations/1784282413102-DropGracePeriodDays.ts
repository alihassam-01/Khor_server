import { MigrationInterface, QueryRunner } from "typeorm";

export class DropGracePeriodDays1784282413102 implements MigrationInterface {
    name = 'DropGracePeriodDays1784282413102'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vendor_subscriptions" DROP COLUMN "grace_period_days"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "vendor_subscriptions" ADD "grace_period_days" integer NOT NULL DEFAULT 7`);
    }
}
