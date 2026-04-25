import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlanIdToAdsSafe1777079000000 implements MigrationInterface {
    name = 'AddPlanIdToAdsSafe1777079000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add plan_id column to restaurants as nullable uuid
        await queryRunner.query(`ALTER TABLE "restaurants" ADD "plan_id" uuid`);
        
        // Add plan_id column to hotels as nullable uuid
        await queryRunner.query(`ALTER TABLE "hotels" ADD "plan_id" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "hotels" DROP COLUMN "plan_id"`);
        await queryRunner.query(`ALTER TABLE "restaurants" DROP COLUMN "plan_id"`);
    }

}
