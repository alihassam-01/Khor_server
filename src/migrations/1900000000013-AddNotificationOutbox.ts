import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNotificationOutbox1900000000013 implements MigrationInterface {
    name = "AddNotificationOutbox1900000000013";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TYPE "notification_channel" AS ENUM ('whatsapp')
        `);
        await queryRunner.query(`
            CREATE TYPE "notification_outbox_status" AS ENUM (
                'pending',
                'processing',
                'sent',
                'retry',
                'failed',
                'unknown',
                'cancelled'
            )
        `);
        await queryRunner.query(`
            CREATE TABLE "notification_outbox" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "event_key" varchar(255) NOT NULL,
                "channel" "notification_channel" NOT NULL,
                "event_type" varchar(120) NOT NULL,
                "recipient_type" varchar(30) NOT NULL,
                "recipient_user_id" uuid,
                "booking_id" uuid,
                "listing_id" uuid,
                "destination" varchar(50) NOT NULL,
                "template_key" varchar(120) NOT NULL,
                "payload" jsonb NOT NULL,
                "status" "notification_outbox_status" NOT NULL DEFAULT 'pending',
                "attempt_count" int NOT NULL DEFAULT 0,
                "next_attempt_at" timestamptz NOT NULL DEFAULT now(),
                "locked_at" timestamptz,
                "provider_message_id" varchar(255),
                "last_error" text,
                "sent_at" timestamptz,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "uq_notification_outbox_event_key" UNIQUE ("event_key"),
                CONSTRAINT "fk_notification_outbox_recipient" FOREIGN KEY ("recipient_user_id") REFERENCES "user"("id") ON DELETE SET NULL,
                CONSTRAINT "fk_notification_outbox_booking" FOREIGN KEY ("booking_id") REFERENCES "hotel_bookings"("id") ON DELETE CASCADE,
                CONSTRAINT "fk_notification_outbox_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE,
                CONSTRAINT "chk_notification_outbox_attempt_count" CHECK ("attempt_count" >= 0)
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_notification_outbox_due"
            ON "notification_outbox" ("status", "next_attempt_at")
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_notification_outbox_booking"
            ON "notification_outbox" ("booking_id")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS "notification_outbox"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "notification_outbox_status"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "notification_channel"`);
    }
}

