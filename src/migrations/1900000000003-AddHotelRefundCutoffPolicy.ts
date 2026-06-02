import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHotelRefundCutoffPolicy1900000000003 implements MigrationInterface {
    name = "AddHotelRefundCutoffPolicy1900000000003";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "hotel_details"
            ADD COLUMN "refund_cutoff_hours" int
        `);

        await queryRunner.query(`
            ALTER TABLE "hotel_details"
            ADD CONSTRAINT "chk_hotel_details_refund_cutoff_hours"
            CHECK ("refund_cutoff_hours" IS NULL OR "refund_cutoff_hours" >= 0)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "hotel_details"
            DROP CONSTRAINT IF EXISTS "chk_hotel_details_refund_cutoff_hours"
        `);

        await queryRunner.query(`
            ALTER TABLE "hotel_details"
            DROP COLUMN IF EXISTS "refund_cutoff_hours"
        `);
    }
}
