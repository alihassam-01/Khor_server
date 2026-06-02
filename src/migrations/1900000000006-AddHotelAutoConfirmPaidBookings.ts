import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHotelAutoConfirmPaidBookings1900000000006 implements MigrationInterface {
    name = "AddHotelAutoConfirmPaidBookings1900000000006";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "hotel_details"
            ADD COLUMN IF NOT EXISTS "auto_confirm_paid_bookings" boolean NOT NULL DEFAULT false
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "hotel_details"
            DROP COLUMN IF EXISTS "auto_confirm_paid_bookings"
        `);
    }
}
