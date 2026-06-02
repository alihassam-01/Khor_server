import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHotelRoomBedDetails1900000000004 implements MigrationInterface {
    name = "AddHotelRoomBedDetails1900000000004";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "hotel_room_types"
            ADD COLUMN IF NOT EXISTS "bed_details" varchar(120)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "hotel_room_types"
            DROP COLUMN IF EXISTS "bed_details"
        `);
    }
}
