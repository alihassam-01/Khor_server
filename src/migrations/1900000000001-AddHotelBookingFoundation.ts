import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHotelBookingFoundation1900000000001 implements MigrationInterface {
    name = "AddHotelBookingFoundation1900000000001";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TYPE "hotel_booking_source" AS ENUM ('customer_web','partner_manual')`,
        );
        await queryRunner.query(
            `CREATE TYPE "hotel_booking_status" AS ENUM ('pending','confirmed','checked_in','completed','cancelled')`,
        );
        await queryRunner.query(
            `CREATE TYPE "booking_payment_status" AS ENUM ('pending','authorized','partially_paid','paid','failed','partially_refunded','refunded')`,
        );
        await queryRunner.query(
            `CREATE TYPE "booking_refund_status" AS ENUM ('none','requested','approved','processing','completed','rejected')`,
        );
        await queryRunner.query(
            `CREATE TYPE "booking_cancellation_status" AS ENUM ('not_requested','requested','approved','rejected','cancelled')`,
        );
        await queryRunner.query(
            `CREATE TYPE "booking_refund_type" AS ENUM ('full','partial')`,
        );
        await queryRunner.query(
            `CREATE TYPE "booking_audit_actor_role" AS ENUM ('customer','vendor','admin','system')`,
        );
        await queryRunner.query(
            `CREATE TYPE "booking_status_type" AS ENUM ('booking','payment','refund','cancellation')`,
        );
        await queryRunner.query(
            `CREATE TYPE "booking_payments_payment_method_enum" AS ENUM ('cash','bank_transfer','easypaisa','jazzcash','credit_card','debit_card')`,
        );

        await queryRunner.query(`
            CREATE TABLE "hotel_bookings" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "booking_number" varchar(40) NOT NULL UNIQUE,
                "source" "hotel_booking_source" NOT NULL DEFAULT 'customer_web',
                "customer_user_id" uuid,
                "guest_name" varchar(160) NOT NULL,
                "guest_email" varchar(255) NOT NULL,
                "guest_phone" varchar(50) NOT NULL,
                "listing_id" uuid NOT NULL,
                "room_type_id" uuid NOT NULL,
                "rooms_count" int NOT NULL,
                "guest_count" int NOT NULL,
                "check_in_date" date NOT NULL,
                "check_out_date" date NOT NULL,
                "nights" int NOT NULL,
                "currency" varchar(3) NOT NULL DEFAULT 'PKR',
                "nightly_rate_snapshot" numeric(10,2) NOT NULL,
                "subtotal_amount" numeric(10,2) NOT NULL,
                "discount_amount" numeric(10,2) NOT NULL DEFAULT 0,
                "tax_amount" numeric(10,2) NOT NULL DEFAULT 0,
                "total_amount" numeric(10,2) NOT NULL,
                "booking_status" "hotel_booking_status" NOT NULL DEFAULT 'pending',
                "payment_status" "booking_payment_status" NOT NULL DEFAULT 'pending',
                "cancellation_status" "booking_cancellation_status" NOT NULL DEFAULT 'not_requested',
                "refund_status" "booking_refund_status" NOT NULL DEFAULT 'none',
                "special_requests" text,
                "created_by_user_id" uuid,
                "confirmed_by_user_id" uuid,
                "cancelled_by_user_id" uuid,
                "completed_by_user_id" uuid,
                "confirmed_at" timestamptz,
                "cancelled_at" timestamptz,
                "completed_at" timestamptz,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "chk_hotel_bookings_rooms_count" CHECK ("rooms_count" > 0),
                CONSTRAINT "chk_hotel_bookings_guest_count" CHECK ("guest_count" > 0),
                CONSTRAINT "chk_hotel_bookings_nights" CHECK ("nights" > 0),
                CONSTRAINT "chk_hotel_bookings_date_range" CHECK ("check_out_date" > "check_in_date"),
                CONSTRAINT "fk_hotel_bookings_customer" FOREIGN KEY ("customer_user_id") REFERENCES "user"("id") ON DELETE SET NULL,
                CONSTRAINT "fk_hotel_bookings_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT,
                CONSTRAINT "fk_hotel_bookings_room_type" FOREIGN KEY ("room_type_id") REFERENCES "hotel_room_types"("id") ON DELETE RESTRICT,
                CONSTRAINT "fk_hotel_bookings_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL,
                CONSTRAINT "fk_hotel_bookings_confirmed_by" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL,
                CONSTRAINT "fk_hotel_bookings_cancelled_by" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL,
                CONSTRAINT "fk_hotel_bookings_completed_by" FOREIGN KEY ("completed_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(
            `CREATE INDEX "idx_hotel_bookings_customer" ON "hotel_bookings" ("customer_user_id")`,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_hotel_bookings_listing_dates" ON "hotel_bookings" ("listing_id","check_in_date","check_out_date")`,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_hotel_bookings_room_type_dates_status" ON "hotel_bookings" ("room_type_id","check_in_date","check_out_date","booking_status")`,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_hotel_bookings_source_status_created" ON "hotel_bookings" ("source","booking_status","created_at")`,
        );

        await queryRunner.query(`
            CREATE TABLE "hotel_booking_allocations" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "booking_id" uuid NOT NULL,
                "listing_id" uuid NOT NULL,
                "room_type_id" uuid NOT NULL,
                "quantity_reserved" int NOT NULL,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "uq_hotel_booking_allocations_booking_room_type" UNIQUE ("booking_id","room_type_id"),
                CONSTRAINT "chk_hotel_booking_allocations_quantity" CHECK ("quantity_reserved" > 0),
                CONSTRAINT "fk_hotel_booking_allocations_booking" FOREIGN KEY ("booking_id") REFERENCES "hotel_bookings"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_hotel_booking_allocations_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT,
                CONSTRAINT "fk_hotel_booking_allocations_room_type" FOREIGN KEY ("room_type_id") REFERENCES "hotel_room_types"("id") ON DELETE RESTRICT
            )
        `);
        await queryRunner.query(
            `CREATE INDEX "idx_hotel_booking_allocations_listing_room_type" ON "hotel_booking_allocations" ("listing_id","room_type_id")`,
        );

        await queryRunner.query(`
            CREATE TABLE "booking_payments" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "booking_id" uuid NOT NULL,
                "payment_method" "booking_payments_payment_method_enum",
                "payment_status" "booking_payment_status" NOT NULL DEFAULT 'pending',
                "currency" varchar(3) NOT NULL DEFAULT 'PKR',
                "amount" numeric(10,2) NOT NULL,
                "captured_amount" numeric(10,2) NOT NULL DEFAULT 0,
                "refunded_amount" numeric(10,2) NOT NULL DEFAULT 0,
                "provider" varchar(100),
                "provider_payment_id" varchar(255),
                "transaction_id" varchar(255),
                "receipt_url" text,
                "notes" text,
                "metadata" jsonb,
                "created_by_user_id" uuid,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "fk_booking_payments_booking" FOREIGN KEY ("booking_id") REFERENCES "hotel_bookings"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_booking_payments_created_by" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(
            `CREATE INDEX "idx_booking_payments_booking_status" ON "booking_payments" ("booking_id","payment_status")`,
        );

        await queryRunner.query(`
            CREATE TABLE "booking_refunds" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "booking_id" uuid NOT NULL,
                "payment_id" uuid,
                "refund_type" "booking_refund_type" NOT NULL DEFAULT 'full',
                "reason" text,
                "requested_by_user_id" uuid,
                "approved_by_user_id" uuid,
                "amount" numeric(10,2) NOT NULL,
                "status" "booking_refund_status" NOT NULL DEFAULT 'requested',
                "provider_refund_id" varchar(255),
                "metadata" jsonb,
                "processed_at" timestamptz,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "fk_booking_refunds_booking" FOREIGN KEY ("booking_id") REFERENCES "hotel_bookings"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_booking_refunds_payment" FOREIGN KEY ("payment_id") REFERENCES "booking_payments"("id") ON DELETE SET NULL,
                CONSTRAINT "fk_booking_refunds_requested_by" FOREIGN KEY ("requested_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL,
                CONSTRAINT "fk_booking_refunds_approved_by" FOREIGN KEY ("approved_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(
            `CREATE INDEX "idx_booking_refunds_booking_status" ON "booking_refunds" ("booking_id","status")`,
        );

        await queryRunner.query(`
            CREATE TABLE "booking_audit_logs" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "booking_id" uuid NOT NULL,
                "event_type" varchar(100) NOT NULL,
                "actor_user_id" uuid,
                "actor_role" "booking_audit_actor_role" NOT NULL DEFAULT 'system',
                "source" varchar(50),
                "before_state" jsonb,
                "after_state" jsonb,
                "metadata" jsonb,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "fk_booking_audit_logs_booking" FOREIGN KEY ("booking_id") REFERENCES "hotel_bookings"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_booking_audit_logs_actor" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(
            `CREATE INDEX "idx_booking_audit_logs_booking_created" ON "booking_audit_logs" ("booking_id","created_at")`,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_booking_audit_logs_event_type" ON "booking_audit_logs" ("event_type")`,
        );

        await queryRunner.query(`
            CREATE TABLE "booking_status_history" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "booking_id" uuid NOT NULL,
                "status_type" "booking_status_type" NOT NULL,
                "from_status" varchar(50),
                "to_status" varchar(50) NOT NULL,
                "changed_by_user_id" uuid,
                "reason" text,
                "metadata" jsonb,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "fk_booking_status_history_booking" FOREIGN KEY ("booking_id") REFERENCES "hotel_bookings"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_booking_status_history_changed_by" FOREIGN KEY ("changed_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL
            )
        `);
        await queryRunner.query(
            `CREATE INDEX "idx_booking_status_history_booking_type_created" ON "booking_status_history" ("booking_id","status_type","created_at")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_booking_status_history_booking_type_created"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "booking_status_history"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "idx_booking_audit_logs_event_type"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_booking_audit_logs_booking_created"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "booking_audit_logs"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "idx_booking_refunds_booking_status"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "booking_refunds"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "idx_booking_payments_booking_status"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "booking_payments"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "booking_payments_payment_method_enum"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "idx_hotel_booking_allocations_listing_room_type"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "hotel_booking_allocations"`);

        await queryRunner.query(`DROP INDEX IF EXISTS "idx_hotel_bookings_source_status_created"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_hotel_bookings_room_type_dates_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_hotel_bookings_listing_dates"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_hotel_bookings_customer"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "hotel_bookings"`);

        await queryRunner.query(`DROP TYPE IF EXISTS "booking_status_type"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "booking_audit_actor_role"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "booking_refund_type"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "booking_cancellation_status"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "booking_refund_status"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "booking_payment_status"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "hotel_booking_status"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "hotel_booking_source"`);
    }
}
