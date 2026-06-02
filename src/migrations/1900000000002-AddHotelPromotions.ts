import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHotelPromotions1900000000002 implements MigrationInterface {
    name = "AddHotelPromotions1900000000002";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "hotel_promotions" (
                "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                "listing_id" uuid NOT NULL,
                "name" varchar(160) NOT NULL,
                "discount_type" varchar(20) NOT NULL,
                "discount_value" numeric(10,2) NOT NULL,
                "applies_to" varchar(50) NOT NULL DEFAULT 'all',
                "start_date" date NOT NULL,
                "end_date" date NOT NULL,
                "is_active" boolean NOT NULL DEFAULT true,
                "usage_count" integer NOT NULL DEFAULT 0,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now(),
                CONSTRAINT "fk_hotel_promotions_listing" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE
            )
        `);
        await queryRunner.query(`CREATE INDEX "idx_hotel_promotions_listing_id" ON "hotel_promotions" ("listing_id")`);
        await queryRunner.query(`CREATE INDEX "idx_hotel_promotions_active_dates" ON "hotel_promotions" ("is_active", "start_date", "end_date")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "idx_hotel_promotions_active_dates"`);
        await queryRunner.query(`DROP INDEX "idx_hotel_promotions_listing_id"`);
        await queryRunner.query(`DROP TABLE "hotel_promotions"`);
    }
}
