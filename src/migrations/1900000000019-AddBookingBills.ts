import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingBills1900000000019 implements MigrationInterface {
    name = "AddBookingBills1900000000019";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "booking_bills" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "booking_id" uuid NOT NULL,
                "currency" varchar(3) NOT NULL DEFAULT 'PKR',
                "created_by_user_id" uuid,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_booking_bills_id" PRIMARY KEY ("id"),
                CONSTRAINT "uq_booking_bills_booking" UNIQUE ("booking_id"),
                CONSTRAINT "FK_booking_bills_booking" FOREIGN KEY ("booking_id") REFERENCES "hotel_bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_booking_bills_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "booking_bill_items" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "bill_id" uuid NOT NULL,
                "item_name" varchar(160) NOT NULL,
                "amount" numeric(10,2) NOT NULL,
                "notes" text,
                "daily_digest_sent_at" TIMESTAMPTZ,
                "created_by_user_id" uuid,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_booking_bill_items_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_booking_bill_items_bill" FOREIGN KEY ("bill_id") REFERENCES "booking_bills"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_booking_bill_items_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_booking_bill_items_bill_created" ON "booking_bill_items" ("bill_id", "created_at")`);
        await queryRunner.query(`CREATE INDEX "idx_booking_bill_items_digest" ON "booking_bill_items" ("daily_digest_sent_at")`);

        await queryRunner.query(`
            CREATE TABLE "booking_bill_payments" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "bill_id" uuid NOT NULL,
                "currency" varchar(3) NOT NULL DEFAULT 'PKR',
                "amount" numeric(10,2) NOT NULL,
                "payment_method" varchar(50),
                "transaction_id" varchar(255),
                "notes" text,
                "created_by_user_id" uuid,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_booking_bill_payments_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_booking_bill_payments_bill" FOREIGN KEY ("bill_id") REFERENCES "booking_bills"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_booking_bill_payments_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_booking_bill_payments_bill_created" ON "booking_bill_payments" ("bill_id", "created_at")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_booking_bill_payments_bill_created"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "booking_bill_payments"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_booking_bill_items_digest"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_booking_bill_items_bill_created"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "booking_bill_items"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "booking_bills"`);
    }
}
