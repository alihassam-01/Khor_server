import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFullTextSearch1732623918000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add search_vector column to properties
        await queryRunner.query(`
            ALTER TABLE "properties" ADD COLUMN "search_vector" tsvector;
        `);

        // Add search_vector column to tour_packages
        await queryRunner.query(`
            ALTER TABLE "tour_packages" ADD COLUMN "search_vector" tsvector;
        `);

        // Create GIN indexes
        await queryRunner.query(`
            CREATE INDEX "idx_properties_search_vector" ON "properties" USING GIN ("search_vector");
        `);
        await queryRunner.query(`
            CREATE INDEX "idx_tour_packages_search_vector" ON "tour_packages" USING GIN ("search_vector");
        `);

        // Create function to update search_vector for properties
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION properties_search_vector_update() RETURNS trigger AS $$
            BEGIN
                NEW.search_vector :=
                    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
                    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
                    setweight(to_tsvector('english', array_to_string(NEW.amenities, ' ')), 'C');
                RETURN NEW;
            END
            $$ LANGUAGE plpgsql;
        `);

        // Create trigger for properties
        await queryRunner.query(`
            CREATE TRIGGER properties_search_vector_update
            BEFORE INSERT OR UPDATE ON "properties"
            FOR EACH ROW
            EXECUTE PROCEDURE properties_search_vector_update();
        `);

        // Create function to update search_vector for tour_packages
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION tour_packages_search_vector_update() RETURNS trigger AS $$
            BEGIN
                NEW.search_vector :=
                    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
                    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
                    setweight(to_tsvector('english', array_to_string(NEW.includes, ' ')), 'C');
                RETURN NEW;
            END
            $$ LANGUAGE plpgsql;
        `);

        // Create trigger for tour_packages
        await queryRunner.query(`
            CREATE TRIGGER tour_packages_search_vector_update
            BEFORE INSERT OR UPDATE ON "tour_packages"
            FOR EACH ROW
            EXECUTE PROCEDURE tour_packages_search_vector_update();
        `);

        // Update existing data
        await queryRunner.query(`
            UPDATE "properties" SET search_vector =
                setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
                setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
                setweight(to_tsvector('english', array_to_string(amenities, ' ')), 'C');
        `);

        await queryRunner.query(`
            UPDATE "tour_packages" SET search_vector =
                setweight(to_tsvector('english', COALESCE(name, '')), 'A') ||
                setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
                setweight(to_tsvector('english', array_to_string(includes, ' ')), 'C');
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER IF EXISTS properties_search_vector_update ON "properties"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS properties_search_vector_update`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS tour_packages_search_vector_update ON "tour_packages"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS tour_packages_search_vector_update`);
        await queryRunner.query(`DROP INDEX "idx_properties_search_vector"`);
        await queryRunner.query(`DROP INDEX "idx_tour_packages_search_vector"`);
        await queryRunner.query(`ALTER TABLE "properties" DROP COLUMN "search_vector"`);
        await queryRunner.query(`ALTER TABLE "tour_packages" DROP COLUMN "search_vector"`);
    }
}
