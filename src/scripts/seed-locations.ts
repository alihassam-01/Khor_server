import { AppDataSource } from "../config/ormconfig";
import { Location } from "../modules/user/entity/location/location.entity";
import { LocationCategory } from "../modules/user/entity/location/location-category.entity";
import { LocationCategoryMapping } from "../modules/user/entity/location/location-category-mapping.entity";
import { LocationAttributes } from "../modules/user/entity/location/location-attributes.entity";
import { gilgitBaltistanLocations } from "./seeds/data/gilgit-baltistan";

// Simple slugify helper to avoid external dependency
function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/[^\w-]+/g, '')  // Remove all non-word chars
        .replace(/--+/g, '-')     // Replace multiple - with single -
        .replace(/^-+/, '')       // Trim - from start of text
        .replace(/-+$/, '');      // Trim - from end of text
}

async function seedLocations() {
    try {
        await AppDataSource.initialize();
        console.log("Database connected.");

        const locationRepo = AppDataSource.getRepository(Location);
        const categoryRepo = AppDataSource.getRepository(LocationCategory);
        const categoryMappingRepo = AppDataSource.getRepository(LocationCategoryMapping);
        const attributesRepo = AppDataSource.getRepository(LocationAttributes);

        // 1. Seed Categories
        console.log("Seeding Categories...");
        const uniqueCategories = new Set<string>();
        gilgitBaltistanLocations.forEach(loc => loc.categories.forEach(c => uniqueCategories.add(c)));

        const categoryMap = new Map<string, LocationCategory>();

        for (const catName of uniqueCategories) {
            const slug = slugify(catName);
            let category = await categoryRepo.findOne({ where: { slug } });

            if (!category) {
                // Find or create category based on name/slug to avoid duplicates
                category = categoryRepo.create({
                    name: catName,
                    slug: slug,
                });
                await categoryRepo.save(category);
                console.log(`Created Category: ${catName}`);
            }
            categoryMap.set(catName, category);
        }

        // 2. Seed Locations
        console.log("Seeding Locations...");

        // We make multiple passes to ensure parents are created before children
        // This handles the hierarchy dependency
        const locationsToProcess = [...gilgitBaltistanLocations];
        const createdLocations = new Map<string, Location>();

        let pass = 0;
        while (locationsToProcess.length > 0 && pass < 6) {
            pass++;
            console.log(`Pass ${pass}: Processing ${locationsToProcess.length} locations...`);

            const nextBatch = [];

            for (const locData of locationsToProcess) {
                // Resolve Parent
                let parent: Location | undefined;
                if (locData.parentSlug) {
                    // Check memory cache first
                    if (createdLocations.has(locData.parentSlug)) {
                        parent = createdLocations.get(locData.parentSlug);
                    } else {
                        // Check DB
                        const dbParent = await locationRepo.findOne({ where: { slug: locData.parentSlug } });
                        if (dbParent) {
                            createdLocations.set(locData.parentSlug, dbParent);
                            parent = dbParent;
                        }
                    }

                    // If parent specified but not found yet, defer this location to next batch
                    if (!parent) {
                        nextBatch.push(locData);
                        continue;
                    }
                }

                // Create or Update Location
                let location = await locationRepo.findOne({ where: { slug: locData.slug } });

                if (!location) {
                    location = locationRepo.create({
                        name: locData.name,
                        slug: locData.slug,
                        description: locData.description,
                        parent: parent || undefined,
                    });
                    await locationRepo.save(location);
                    console.log(`Created Location: ${locData.name}`);
                } else {
                    // Link parent if it wasn't linked before
                    if (parent && (!location.parent || location.parent.location_id !== parent.location_id)) {
                        location.parent = parent;
                        await locationRepo.save(location);
                    }
                }
                createdLocations.set(locData.slug, location);

                // 3. Link Categories
                for (const catName of locData.categories) {
                    const category = categoryMap.get(catName);
                    if (category) {
                        const existingMapping = await categoryMappingRepo.findOne({
                            where: {
                                location: { location_id: location.location_id },
                                category: { categoryId: category.categoryId }
                            }
                        });
                        if (!existingMapping) {
                            await categoryMappingRepo.save({
                                location,
                                category
                            });
                        }
                    }
                }

                // 4. Create/Update Attributes
                for (const [key, value] of Object.entries(locData.attributes)) {
                    if (!value) continue; // Skip empty attributes

                    const existingAttr = await attributesRepo.findOne({
                        where: {
                            location_id: location.location_id,
                            attributeKey: key
                        }
                    });

                    if (existingAttr) {
                        if (existingAttr.attributeValue !== value) {
                            existingAttr.attributeValue = value;
                            await attributesRepo.save(existingAttr);
                        }
                    } else {
                        await attributesRepo.save({
                            location_id: location.location_id,
                            attributeKey: key,
                            attributeValue: value
                        });
                    }
                }
            }

            // If no progress (same count), we might have an orphan or circular dep
            if (nextBatch.length === locationsToProcess.length && nextBatch.length > 0) {
                console.warn("Potential circular dependency or missing parent for:", nextBatch.map(s => s.name));
                // Force break or handle simple orphans? For now, we break.
                break;
            }
            locationsToProcess.length = 0;
            locationsToProcess.push(...nextBatch);
        }

        console.log("Seeding Complete!");
        process.exit(0);

    } catch (error) {
        console.error("Error Seeding:", error);
        process.exit(1);
    }
}

seedLocations();
