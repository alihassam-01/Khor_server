import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingRefundPolicySnapshots1900000000012 implements MigrationInterface {
    name = "AddBookingRefundPolicySnapshots1900000000012";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "hotel_bookings"
            ADD COLUMN IF NOT EXISTS "cancellation_policy_snapshot" text,
            ADD COLUMN IF NOT EXISTS "refund_cutoff_hours_snapshot" int
        `);

        await queryRunner.query(`
            UPDATE "hotel_bookings" hb
            SET
                "cancellation_policy_snapshot" = hd."cancellation_policy",
                "refund_cutoff_hours_snapshot" = hd."refund_cutoff_hours"
            FROM "hotel_details" hd
            WHERE hd."listing_id" = hb."listing_id"
              AND (
                hb."cancellation_policy_snapshot" IS NULL
                OR hb."refund_cutoff_hours_snapshot" IS NULL
              )
        `);

        await queryRunner.query(`
            ALTER TABLE "hotel_bookings"
            ADD CONSTRAINT "chk_hotel_bookings_refund_cutoff_snapshot"
            CHECK ("refund_cutoff_hours_snapshot" IS NULL OR "refund_cutoff_hours_snapshot" >= 0) NOT VALID
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hotel_bookings" DROP CONSTRAINT IF EXISTS "chk_hotel_bookings_refund_cutoff_snapshot"`);
        await queryRunner.query(`
            ALTER TABLE "hotel_bookings"
            DROP COLUMN IF EXISTS "refund_cutoff_hours_snapshot",
            DROP COLUMN IF EXISTS "cancellation_policy_snapshot"
        `);
    }
}
