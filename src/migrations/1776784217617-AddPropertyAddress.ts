import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPropertyAddress1776784217617 implements MigrationInterface {
    name = 'AddPropertyAddress1776784217617'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hotels" ADD "address" text`);
        await queryRunner.query(`ALTER TABLE "restaurants" ADD "address" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "address"`);
        await queryRunner.query(`ALTER TABLE "hotels" DROP COLUMN "address"`);
    }

}
