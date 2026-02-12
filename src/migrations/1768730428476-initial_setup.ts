import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSetup1768730428476 implements MigrationInterface {
    name = 'InitialSetup1768730428476'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hotels" ALTER COLUMN "amenities" SET DEFAULT ARRAY[]::text[]`);
        await queryRunner.query(`ALTER TABLE "articles" ALTER COLUMN "image_urls" SET DEFAULT ARRAY[]::text[]`);
        await queryRunner.query(`ALTER TABLE "restaurants" ALTER COLUMN "menu_images" SET DEFAULT ARRAY[]::text[]`);
        await queryRunner.query(`ALTER TABLE "hotel_room_types" ALTER COLUMN "amenities" SET DEFAULT ARRAY[]::text[]`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hotel_room_types" ALTER COLUMN "amenities" SET DEFAULT ARRAY[]`);
        await queryRunner.query(`ALTER TABLE "restaurants" ALTER COLUMN "menu_images" SET DEFAULT ARRAY[]`);
        await queryRunner.query(`ALTER TABLE "articles" ALTER COLUMN "image_urls" SET DEFAULT ARRAY[]`);
        await queryRunner.query(`ALTER TABLE "hotels" ALTER COLUMN "amenities" SET DEFAULT ARRAY[]`);
    }

}
