import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableColumn, TableIndex } from "typeorm";

export class MigrateArticleToManyToMany1776105434299 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Create the join table
        await queryRunner.createTable(new Table({
            name: "article_locations",
            columns: [
                {
                    name: "article_id",
                    type: "integer",
                    isPrimary: true,
                },
                {
                    name: "location_id",
                    type: "integer",
                    isPrimary: true,
                }
            ]
        }), true);

        // 2. Add foreign keys to join table
        await queryRunner.createForeignKeys("article_locations", [
            new TableForeignKey({
                columnNames: ["article_id"],
                referencedColumnNames: ["article_id"],
                referencedTableName: "articles",
                onDelete: "CASCADE",
                onUpdate: "CASCADE"
            }),
            new TableForeignKey({
                columnNames: ["location_id"],
                referencedColumnNames: ["location_id"],
                referencedTableName: "location",
                onDelete: "CASCADE",
                onUpdate: "CASCADE"
            })
        ]);

        // 3. Add indices to join table
        await queryRunner.createIndices("article_locations", [
            new TableIndex({
                columnNames: ["article_id"],
                name: "IDX_article_locations_article_id"
            }),
            new TableIndex({
                columnNames: ["location_id"],
                name: "IDX_article_locations_location_id"
            })
        ]);

        // 4. Migrate existing data
        await queryRunner.query(`
            INSERT INTO "article_locations" ("article_id", "location_id")
            SELECT "article_id", "location_id" 
            FROM "articles" 
            WHERE "location_id" IS NOT NULL
        `);

        // 5. Drop old foreign key and column from articles
        const table = await queryRunner.getTable("articles");
        if (table) {
            const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf("location_id") !== -1);
            if (foreignKey) {
                await queryRunner.dropForeignKey("articles", foreignKey);
            }
            
            // Also drop unique constraint if exists
            const unique = table.uniques.find(u => u.columnNames.indexOf("location_id") !== -1);
            if (unique) {
                await queryRunner.dropUniqueConstraint("articles", unique);
            }

            // Drop any indices on location_id
            const indices = table.indices.filter(idx => idx.columnNames.indexOf("location_id") !== -1);
            for (const idx of indices) {
                await queryRunner.dropIndex("articles", idx);
            }

            await queryRunner.dropColumn("articles", "location_id");
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // 1. Add location_id back to articles
        await queryRunner.addColumn("articles", new TableColumn({
            name: "location_id",
            type: "integer",
            isNullable: true
        }));

        // 2. Restore data (best effort: pick first location)
        await queryRunner.query(`
            UPDATE "articles"
            SET "location_id" = (
                SELECT "location_id" 
                FROM "article_locations" 
                WHERE "article_locations"."article_id" = "articles"."article_id" 
                LIMIT 1
            )
        `);

        // 3. Restore foreign key
        await queryRunner.createForeignKey("articles", new TableForeignKey({
            columnNames: ["location_id"],
            referencedColumnNames: ["location_id"],
            referencedTableName: "location",
            onDelete: "SET NULL"
        }));

        // 4. Drop the join table
        await queryRunner.dropTable("article_locations");
    }

}
