import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddHashToS3Images1776430000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            "s3_images",
            new TableColumn({
                name: "hash",
                type: "varchar",
                length: "255",
                isNullable: true,
            })
        );
        
        // Add index for faster duplicate lookup
        await queryRunner.query(`CREATE INDEX "IDX_S3_IMAGES_HASH" ON "s3_images" ("hash") WHERE "isDeleted" = false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropIndex("s3_images", "IDX_S3_IMAGES_HASH");
        await queryRunner.dropColumn("s3_images", "hash");
    }

}
