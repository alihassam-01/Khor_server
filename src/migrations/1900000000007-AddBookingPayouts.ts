import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingPayouts1900000000007 implements MigrationInterface {
    name = "AddBookingPayouts1900000000007";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "booking_payouts" (
                "payout_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "booking_id" uuid NOT NULL,
                "vendor_id" uuid NULL,
                "amount" numeric(10,2) NOT NULL,
                "status" character varying(20) NOT NULL DEFAULT 'pending',
                "payout_date" TIMESTAMPTZ NULL,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_booking_payouts_payout_id" PRIMARY KEY ("payout_id"),
                CONSTRAINT "UQ_booking_payouts_booking_id" UNIQUE ("booking_id"),
                CONSTRAINT "CHK_booking_payouts_status" CHECK ("status" IN ('pending','completed','failed'))
            )
        `);

        await queryRunner.query(`
            CREATE INDEX "idx_booking_payouts_vendor_status"
            ON "booking_payouts" ("vendor_id", "status")
        `);

        await queryRunner.query(`
            ALTER TABLE "booking_payouts"
            ADD CONSTRAINT "FK_booking_payouts_booking"
            FOREIGN KEY ("booking_id") REFERENCES "hotel_bookings"("id")
            ON DELETE CASCADE ON UPDATE NO ACTION
        `);

        await queryRunner.query(`
            ALTER TABLE "booking_payouts"
            ADD CONSTRAINT "FK_booking_payouts_vendor"
            FOREIGN KEY ("vendor_id") REFERENCES "user"("id")
            ON DELETE SET NULL ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "booking_payouts" DROP CONSTRAINT "FK_booking_payouts_vendor"`);
        await queryRunner.query(`ALTER TABLE "booking_payouts" DROP CONSTRAINT "FK_booking_payouts_booking"`);
        await queryRunner.query(`DROP INDEX "public"."idx_booking_payouts_vendor_status"`);
        await queryRunner.query(`DROP TABLE "booking_payouts"`);
    }
}
