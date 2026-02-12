# Seeding Guide - Locations & Articles

## Overview
Complete seed scripts for populating your Gilgit-Baltistan travel database with:
- **32 Locations** (1 region + 6 districts + 25 specific spots)
- **33 Articles** (one for each location + general guide articles)

## Files Created

### 1. Location Seed File
**File:** `src/scripts/seeds/data/gilgit-baltistan.ts`
- Contains all 32 locations with complete information
- Each location has: name, slug, description, category, attributes (SEO, distance, best time, etc.)

### 2. Article Seed File  
**File:** `src/scripts/seeds/data/articles-gilgit-baltistan.ts`
- Contains 33 articles covering all locations
- Each article has: title, slug, excerpt, content, SEO metadata
- Articles are linked to locations via `location_slug`

### 3. Location Seed Script
**File:** `src/scripts/seed-locations.ts`
- Handles database initialization
- Creates location categories
- Seeds locations with hierarchical parent-child relationships
- Links categories to locations
- Stores location attributes (SEO, tourism info, etc.)

### 4. Article Seed Script
**File:** `src/scripts/seed-articles.ts`
- Handles article database seeding
- Links articles to locations via location lookup
- Prevents duplicate articles
- Creates articles with published_at timestamp

## Running the Seeds

### Option 1: Seed Only Locations
```bash
npm run seed:locations
```

### Option 2: Seed Only Articles
```bash
npm run seed:articles
```

### Option 3: Seed Everything (Locations + Articles)
```bash
npm run seed:all
```

## Script Behavior

### Locations Seeding (`seed-locations.ts`)
- ✅ Creates categories dynamically from location data
- ✅ Handles hierarchical relationships (parent-child)
- ✅ Processes in multiple passes to resolve dependencies
- ✅ Skips existing locations
- ✅ Creates location attributes (SEO, tourism info)
- ✅ Warns about orphaned locations

### Articles Seeding (`seed-articles.ts`)
- ✅ Creates articles with full metadata
- ✅ Links articles to locations automatically
- ✅ Skips duplicate articles (by slug)
- ✅ Warns if location not found
- ✅ Publishes articles immediately (published_at set)
- ✅ Initializes empty image_urls (can be updated via API)

## Location Hierarchy

```
Gilgit Baltistan (Region)
├── Skardu District
│   ├── Shangrila Resort
│   ├── Upper Kachura Lake
│   ├── Deosai National Park
│   ├── Cold Desert Skardu
│   ├── Satpara Lake
│   ├── Buddha Rock
│   ├── Kharpocho Fort
│   ├── Shigar Fort
│   └── Rondu Fort
├── Hunza District
│   ├── Baltit Fort
│   ├── Attabad Lake
│   ├── Passu Cones
│   ├── Khunjerab Pass
│   ├── Altit Fort
│   ├── Hussaini Suspension Bridge
│   └── Batura Glacier
├── Nagar District
│   └── Hopper Valley & Glacier
├── Ghizer District
│   ├── Phander Lake
│   ├── Khalti Lake
│   └── Shandur Top
├── Astore District
│   ├── Rama Meadows & Lake
│   └── Dunga Gali
└── Diamer District
    ├── Fairy Meadows
    └── Beyal Camp
```

## Articles Included

### District Guides (6 articles)
- Skardu Valley - Gateway to K2 & Cold Desert
- Hunza Valley - The Land of Legends & Longevity
- Nagar Valley - Home of Rakaposhi
- Ghizer Valley - Land of Lakes & Trout
- Astore Valley - The Trekker's Paradise
- Diamer District & Fairy Meadows

### Location Guides (27 articles)
- Shangrila Resort - Heaven on Earth
- Upper Kachura Lake - A Pristine Wonder
- Deosai National Park - The Land of Giants
- Cold Desert Skardu - Sand Dunes Meets Snow
- And 23 more...

## Article Structure

Each article contains:
- **Title**: Engaging, SEO-friendly title
- **Slug**: URL-friendly identifier
- **Excerpt**: 1-2 sentence summary
- **Content**: 200-300 words of descriptive content
- **SEO Title**: Search engine optimized title
- **SEO Description**: Meta description for search results
- **SEO Keywords**: Relevant keywords for the location
- **Location Slug**: Link to the corresponding location
- **Published At**: Timestamp (auto-set to current date)

## Example Database Queries

### Get all locations
```sql
SELECT * FROM locations;
```

### Get all articles
```sql
SELECT * FROM articles;
```

### Get articles for a specific location
```sql
SELECT a.* FROM articles a
JOIN locations l ON a.location_id = l.location_id
WHERE l.slug = 'skardu';
```

### Get location details with SEO attributes
```sql
SELECT l.*, la.attributeKey, la.attributeValue
FROM locations l
LEFT JOIN location_attributes la ON l.location_id = la.location_id
WHERE l.slug = 'shangrila-resort';
```

## Troubleshooting

### Articles not linking to locations
- Check that location slugs match exactly (case-sensitive)
- Ensure locations are seeded first
- Verify location_slug value in articles file

### Duplicate entries when re-running
- Scripts check for existing records and skip them
- No data loss occurs on re-run
- To clear and reseed: manually delete records from database or use migration:revert

### Missing categories
- Categories are created automatically from location data
- Check that all locations have valid categories array

## Next Steps

1. **Run Migrations**
   ```bash
   npm run migration:run
   ```

2. **Seed Locations**
   ```bash
   npm run seed:locations
   ```

3. **Seed Articles**
   ```bash
   npm run seed:articles
   ```

4. **Verify Data**
   - Check database for locations
   - Verify articles are linked correctly
   - Test API endpoints

## Notes

- All timestamps are set to current date
- Images can be added to articles via the API or admin dashboard
- Article content is in plain text (can be converted to markdown if needed)
- Location attributes include tourism information (distance, best time to visit, stay options)
- Categories are dynamically created and include: Region, District, Valley, Lake, Mountain, Fort, etc.
