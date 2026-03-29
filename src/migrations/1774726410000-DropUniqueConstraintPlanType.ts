import { MigrationInterface, QueryRunner } from "typeorm";

export class DropUniqueConstraintPlanType1774726410000 implements MigrationInterface {
    name = 'DropUniqueConstraintPlanType1774726410000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Drop the unique constraint on subscription_plans.type
        await queryRunner.query(`ALTER TABLE "subscription_plans" DROP CONSTRAINT IF EXISTS "UQ_a0b884a3a9964aef2cd41fda606"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Re-add the unique constraint if needed for rollback
        await queryRunner.query(`ALTER TABLE "subscription_plans" ADD CONSTRAINT "UQ_a0b884a3a9964aef2cd41fda606" UNIQUE ("type")`);
    }
}
