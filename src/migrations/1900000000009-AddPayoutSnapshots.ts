import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPayoutSnapshots1900000000009 implements MigrationInterface {
    name = "AddPayoutSnapshots1900000000009";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "booking_payouts"
            ADD COLUMN IF NOT EXISTS "gross_amount" numeric(10,2),
            ADD COLUMN IF NOT EXISTS "commission_rate" numeric(8,6),
            ADD COLUMN IF NOT EXISTS "commission_amount" numeric(10,2)
        `);

        await queryRunner.query(`
            UPDATE "booking_payouts" bp
            SET
                "gross_amount" = hb."total_amount",
                "commission_amount" = GREATEST(hb."total_amount" - bp."amount", 0),
                "commission_rate" = CASE
                    WHEN hb."total_amount" > 0
                        THEN GREATEST(hb."total_amount" - bp."amount", 0) / hb."total_amount"
                    ELSE 0
                END
            FROM "hotel_bookings" hb
            WHERE hb."id" = bp."booking_id"
              AND (bp."gross_amount" IS NULL OR bp."commission_amount" IS NULL OR bp."commission_rate" IS NULL)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "booking_payouts"
            DROP COLUMN IF EXISTS "commission_amount",
            DROP COLUMN IF EXISTS "commission_rate",
            DROP COLUMN IF EXISTS "gross_amount"
        `);
    }
}
