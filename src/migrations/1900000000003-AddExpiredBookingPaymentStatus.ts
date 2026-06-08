import { MigrationInterface, QueryRunner } from "typeorm";

export class AddExpiredBookingPaymentStatus1900000000003 implements MigrationInterface {
    name = "AddExpiredBookingPaymentStatus1900000000003";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_enum e
                    JOIN pg_type t ON t.oid = e.enumtypid
                    WHERE t.typname = 'booking_payment_status' AND e.enumlabel = 'expired'
                ) THEN
                    ALTER TYPE "booking_payment_status" ADD VALUE 'expired';
                END IF;
            END$$;
        `);
    }

    public async down(): Promise<void> {
        // PostgreSQL enum values are not safely removable in a simple down migration.
    }
}
