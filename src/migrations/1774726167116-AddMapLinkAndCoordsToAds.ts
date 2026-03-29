import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMapLinkAndCoordsToAds1774726167116 implements MigrationInterface {
    name = 'AddMapLinkAndCoordsToAds1774726167116'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "restaurants" ADD "map_link" text`);
        await queryRunner.query(`ALTER TABLE "restaurants" ADD "latitude" numeric(10,7)`);
        await queryRunner.query(`ALTER TABLE "restaurants" ADD "longitude" numeric(10,7)`);
        await queryRunner.query(`ALTER TABLE "hotels" ADD "map_link" text`);
        await queryRunner.query(`ALTER TABLE "hotels" ADD "latitude" numeric(10,7)`);
        await queryRunner.query(`ALTER TABLE "hotels" ADD "longitude" numeric(10,7)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hotels" DROP COLUMN "longitude"`);
        await queryRunner.query(`ALTER TABLE "hotels" DROP COLUMN "latitude"`);
        await queryRunner.query(`ALTER TABLE "hotels" DROP COLUMN "map_link"`);
        await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "longitude"`);
        await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "latitude"`);
        await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "map_link"`);
    }
}
