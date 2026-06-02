import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingRoomHolds1900000000002 implements MigrationInterface {
    name = "AddBookingRoomHolds1900000000002";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TYPE "booking_hold_status" AS ENUM ('active','consumed','released','expired')`,
        );

        await queryRunner.query(`
            CREATE TABLE "booking_room_holds" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "customer_user_id" uuid NOT NULL,
                "listing_id" uuid NOT NULL,
                "room_type_id" uuid NOT NULL,
                "rooms_count" int NOT NULL,
                "guest_count" int NOT NULL,
                "check_in_date" date NOT NULL,
                "check_out_date" date NOT NULL,
                "status" "booking_hold_status" NOT NULL DEFAULT 'active',
                "expires_at" timestamptz NOT NULL,
                "released_at" timestamptz,
                "consumed_at" timestamptz,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "chk_booking_room_holds_rooms_count" CHECK ("rooms_count" > 0),
                CONSTRAINT "chk_booking_room_holds_guest_count" CHECK ("guest_count" > 0),
                CONSTRAINT "chk_booking_room_holds_date_range" CHECK ("check_out_date" > "check_in_date"),
                CONSTRAINT "fk_booking_room_holds_customer" FOREIGN KEY ("customer_user_id") REFERENCES "user"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_booking_room_holds_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_booking_room_holds_room_type" FOREIGN KEY ("room_type_id") REFERENCES "hotel_room_types"("id") ON DELETE CASCADE
            )
        `);

        await queryRunner.query(
            `CREATE INDEX "idx_booking_room_holds_customer_status" ON "booking_room_holds" ("customer_user_id","status")`,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_booking_room_holds_room_dates_status" ON "booking_room_holds" ("room_type_id","check_in_date","check_out_date","status")`,
        );
        await queryRunner.query(
            `CREATE INDEX "idx_booking_room_holds_expires_status" ON "booking_room_holds" ("expires_at","status")`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_booking_room_holds_expires_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_booking_room_holds_room_dates_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_booking_room_holds_customer_status"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "booking_room_holds"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "booking_hold_status"`);
    }
}
