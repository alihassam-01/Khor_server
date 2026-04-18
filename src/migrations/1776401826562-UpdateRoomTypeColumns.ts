import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateRoomTypeColumns1776401826562 implements MigrationInterface {
    name = 'UpdateRoomTypeColumns1776401826562'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add columns to hotel_room_types if they don't exist
        await queryRunner.query(`ALTER TABLE "hotel_room_types" ADD COLUMN IF NOT EXISTS "name" character varying(255) NOT NULL DEFAULT 'Standard Room'`);
        await queryRunner.query(`ALTER TABLE "hotel_room_types" ADD COLUMN IF NOT EXISTS "description" text`);
        await queryRunner.query(`ALTER TABLE "hotel_room_types" ADD COLUMN IF NOT EXISTS "total_rooms" integer NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE "hotel_room_types" ADD COLUMN IF NOT EXISTS "images" text array NOT NULL DEFAULT ARRAY[]::text[]`);
        await queryRunner.query(`ALTER TABLE "hotel_room_types" ADD COLUMN IF NOT EXISTS "size_sqm" numeric(10,2)`);
        await queryRunner.query(`ALTER TABLE "hotel_room_types" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "hotel_room_types" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "hotel_room_types" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hotel_room_types" DROP COLUMN IF EXISTS "updated_at"`);
        await queryRunner.query(`ALTER TABLE "hotel_room_types" DROP COLUMN IF EXISTS "created_at"`);
        await queryRunner.query(`ALTER TABLE "hotel_room_types" DROP COLUMN IF EXISTS "is_active"`);
        await queryRunner.query(`ALTER TABLE "hotel_room_types" DROP COLUMN IF EXISTS "size_sqm"`);
        await queryRunner.query(`ALTER TABLE "hotel_room_types" DROP COLUMN IF EXISTS "images"`);
        await queryRunner.query(`ALTER TABLE "hotel_room_types" DROP COLUMN IF EXISTS "total_rooms"`);
        await queryRunner.query(`ALTER TABLE "hotel_room_types" DROP COLUMN IF EXISTS "description"`);
        await queryRunner.query(`ALTER TABLE "hotel_room_types" DROP COLUMN IF EXISTS "name"`);
    }
}
