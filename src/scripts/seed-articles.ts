import { AppDataSource } from "../config/ormconfig";
import { Article } from "../modules/user/entity/article/article.entity";
import { Location } from "../modules/user/entity/location/location.entity";
import { gilgitBaltistanArticles } from "./seeds/data/articles-gilgit-baltistan";

async function seedArticles() {
    try {
        await AppDataSource.initialize();
        console.log("Database connected.");

        const articleRepo = AppDataSource.getRepository(Article);
        const locationRepo = AppDataSource.getRepository(Location);

        console.log("Seeding Articles...");

        let createdCount = 0;
        let skippedCount = 0;

        for (const articleData of gilgitBaltistanArticles) {
            // Check if article already exists by slug
            const existingArticle = await articleRepo.findOne({
                where: { slug: articleData.slug }
            });

            if (existingArticle) {
                console.log(`Skipping Article (already exists): ${articleData.title}`);
                skippedCount++;
                continue;
            }

            // Find location by slug
            let location: Location | null = null;
            if (articleData.location_slug) {
                location = await locationRepo.findOne({
                    where: { slug: articleData.location_slug }
                });

                if (!location) {
                    console.warn(`Warning: Location not found for slug "${articleData.location_slug}" - Article will be created without location`);
                }
            }

            // Create article
            const article = articleRepo.create({
                title: articleData.title,
                slug: articleData.slug,
                excerpt: articleData.excerpt,
                content: articleData.content,
                seo_title: articleData.seo_title,
                seo_description: articleData.seo_description,
                seo_keywords: articleData.seo_keywords,
                location: location || undefined,
                published_at: articleData.published_at,
                image_urls: [] // Empty initially, can be updated via API
            });

            await articleRepo.save(article);
            console.log(`Created Article: ${articleData.title}`);
            createdCount++;
        }

        console.log(`\nSeeding Complete!`);
        console.log(`Created: ${createdCount} articles`);
        console.log(`Skipped: ${skippedCount} articles`);
        process.exit(0);

    } catch (error) {
        console.error("Error Seeding:", error);
        process.exit(1);
    }
}

seedArticles();
