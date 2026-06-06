import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingFinancialConstraints1900000000011 implements MigrationInterface {
    name = "AddBookingFinancialConstraints1900000000011";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "hotel_bookings"
            ADD CONSTRAINT "chk_hotel_bookings_amounts_non_negative"
            CHECK (
                "nightly_rate_snapshot" >= 0
                AND "subtotal_amount" >= 0
                AND "discount_amount" >= 0
                AND "tax_amount" >= 0
                AND "total_amount" >= 0
            ) NOT VALID
        `);

        await queryRunner.query(`
            ALTER TABLE "hotel_bookings"
            ADD CONSTRAINT "chk_hotel_bookings_discount_not_over_subtotal"
            CHECK ("discount_amount" <= "subtotal_amount" + "tax_amount") NOT VALID
        `);

        await queryRunner.query(`
            ALTER TABLE "booking_payments"
            ADD CONSTRAINT "chk_booking_payments_amounts_valid"
            CHECK (
                "amount" >= 0
                AND "captured_amount" >= 0
                AND "refunded_amount" >= 0
                AND "captured_amount" <= "amount"
                AND "refunded_amount" <= "captured_amount"
            ) NOT VALID
        `);

        await queryRunner.query(`
            ALTER TABLE "booking_refunds"
            ADD CONSTRAINT "chk_booking_refunds_amount_positive"
            CHECK ("amount" > 0) NOT VALID
        `);

        await queryRunner.query(`
            ALTER TABLE "booking_payouts"
            ADD CONSTRAINT "chk_booking_payouts_amounts_valid"
            CHECK (
                "amount" >= 0
                AND ("gross_amount" IS NULL OR "gross_amount" >= 0)
                AND ("commission_rate" IS NULL OR ("commission_rate" >= 0 AND "commission_rate" <= 1))
                AND ("commission_amount" IS NULL OR "commission_amount" >= 0)
                AND (
                    "gross_amount" IS NULL
                    OR "commission_amount" IS NULL
                    OR "commission_amount" <= "gross_amount"
                )
                AND (
                    "gross_amount" IS NULL
                    OR "amount" <= "gross_amount"
                )
            ) NOT VALID
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "booking_payouts" DROP CONSTRAINT IF EXISTS "chk_booking_payouts_amounts_valid"`);
        await queryRunner.query(`ALTER TABLE "booking_refunds" DROP CONSTRAINT IF EXISTS "chk_booking_refunds_amount_positive"`);
        await queryRunner.query(`ALTER TABLE "booking_payments" DROP CONSTRAINT IF EXISTS "chk_booking_payments_amounts_valid"`);
        await queryRunner.query(`ALTER TABLE "hotel_bookings" DROP CONSTRAINT IF EXISTS "chk_hotel_bookings_discount_not_over_subtotal"`);
        await queryRunner.query(`ALTER TABLE "hotel_bookings" DROP CONSTRAINT IF EXISTS "chk_hotel_bookings_amounts_non_negative"`);
    }
}
