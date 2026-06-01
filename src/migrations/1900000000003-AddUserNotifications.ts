import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserNotifications1900000000003 implements MigrationInterface {
    name = "AddUserNotifications1900000000003";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "user_notifications" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "recipient_user_id" uuid NOT NULL,
                "category" varchar(50) NOT NULL,
                "title" varchar(120) NOT NULL,
                "message" text NOT NULL,
                "action" varchar(120) NOT NULL,
                "booking_id" uuid,
                "hold_id" uuid,
                "listing_id" uuid,
                "room_type_id" uuid,
                "metadata" jsonb,
                "read_at" timestamptz,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "fk_user_notifications_recipient" FOREIGN KEY ("recipient_user_id") REFERENCES "user"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_user_notifications_recipient_created"
            ON "user_notifications" ("recipient_user_id", "created_at")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "idx_user_notifications_recipient_created"`);
        await queryRunner.query(`DROP TABLE "user_notifications"`);
    }
}
