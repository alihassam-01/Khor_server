import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSupportTickets1900000000010 implements MigrationInterface {
    name = "AddSupportTickets1900000000010";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_ticket_type_enum') THEN
                    CREATE TYPE "support_ticket_type_enum" AS ENUM ('general', 'booking');
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'support_ticket_status_enum') THEN
                    CREATE TYPE "support_ticket_status_enum" AS ENUM ('open', 'escalated', 'resolved');
                END IF;
            END
            $$;
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "support_tickets" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "ticket_number" character varying(40) NOT NULL,
                "customer_user_id" uuid NOT NULL,
                "vendor_user_id" uuid,
                "booking_id" uuid,
                "type" "support_ticket_type_enum" NOT NULL DEFAULT 'general',
                "subject" character varying(180) NOT NULL,
                "status" "support_ticket_status_enum" NOT NULL DEFAULT 'open',
                "escalated_at" TIMESTAMPTZ,
                "escalated_by_user_id" uuid,
                "resolved_at" TIMESTAMPTZ,
                "resolved_by_user_id" uuid,
                "last_activity_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_support_tickets_id" PRIMARY KEY ("id"),
                CONSTRAINT "UQ_support_tickets_ticket_number" UNIQUE ("ticket_number"),
                CONSTRAINT "FK_support_tickets_customer" FOREIGN KEY ("customer_user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_support_tickets_vendor" FOREIGN KEY ("vendor_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
                CONSTRAINT "FK_support_tickets_booking" FOREIGN KEY ("booking_id") REFERENCES "hotel_bookings"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
                CONSTRAINT "FK_support_tickets_escalated_by" FOREIGN KEY ("escalated_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
                CONSTRAINT "FK_support_tickets_resolved_by" FOREIGN KEY ("resolved_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE NO ACTION
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_support_tickets_customer_created"
            ON "support_tickets" ("customer_user_id", "created_at")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_support_tickets_vendor_status"
            ON "support_tickets" ("vendor_user_id", "status")
        `);
        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_support_tickets_status_activity"
            ON "support_tickets" ("status", "last_activity_at")
        `);

        await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "support_ticket_messages" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "ticket_id" uuid NOT NULL,
                "author_user_id" uuid NOT NULL,
                "message" text NOT NULL,
                "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT "PK_support_ticket_messages_id" PRIMARY KEY ("id"),
                CONSTRAINT "FK_support_ticket_messages_ticket" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
                CONSTRAINT "FK_support_ticket_messages_author" FOREIGN KEY ("author_user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION
            )
        `);

        await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "idx_support_ticket_messages_ticket_created"
            ON "support_ticket_messages" ("ticket_id", "created_at")
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_support_ticket_messages_ticket_created"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "support_ticket_messages"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_support_tickets_status_activity"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_support_tickets_vendor_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_support_tickets_customer_created"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "support_tickets"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "support_ticket_status_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "support_ticket_type_enum"`);
    }
}
