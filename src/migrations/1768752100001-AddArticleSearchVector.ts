import { MigrationInterface, QueryRunner } from "typeorm";

export class AddArticleSearchVector1768752100001 implements MigrationInterface {
    name = "AddArticleSearchVector1768752100001";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "search_vector" tsvector`);

        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION articles_search_vector_update()
            RETURNS trigger
            AS $$
            BEGIN
              NEW.search_vector :=
                setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
                setweight(to_tsvector('english', COALESCE(NEW.seo_title, '')), 'A') ||
                setweight(to_tsvector('english', COALESCE(NEW.excerpt, '')), 'B') ||
                setweight(to_tsvector('english', COALESCE(NEW.seo_description, '')), 'B') ||
                setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'C') ||
                setweight(to_tsvector('english', COALESCE(NEW.seo_keywords, '')), 'D');
              RETURN NEW;
            END
            $$ LANGUAGE plpgsql
        `);

        await queryRunner.query(`DROP TRIGGER IF EXISTS trg_articles_search_vector_update ON "articles"`);
        await queryRunner.query(`
            CREATE TRIGGER trg_articles_search_vector_update
            BEFORE INSERT OR UPDATE OF title, seo_title, excerpt, seo_description, content, seo_keywords
            ON "articles"
            FOR EACH ROW
            EXECUTE FUNCTION articles_search_vector_update()
        `);

        await queryRunner.query(`
            UPDATE "articles"
            SET "search_vector" =
              setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
              setweight(to_tsvector('english', COALESCE(seo_title, '')), 'A') ||
              setweight(to_tsvector('english', COALESCE(excerpt, '')), 'B') ||
              setweight(to_tsvector('english', COALESCE(seo_description, '')), 'B') ||
              setweight(to_tsvector('english', COALESCE(content, '')), 'C') ||
              setweight(to_tsvector('english', COALESCE(seo_keywords, '')), 'D')
        `);

        await queryRunner.query(`DROP INDEX IF EXISTS "fulltext_index"`);
        await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_articles_search_vector" ON "articles" USING GIN ("search_vector")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS "idx_articles_search_vector"`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS trg_articles_search_vector_update ON "articles"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS articles_search_vector_update`);
        await queryRunner.query(`ALTER TABLE "articles" DROP COLUMN IF EXISTS "search_vector"`);
    }
}
