# Search

Search is implemented in two layers: an inline `searchQuery` parameter
on the listing list endpoints and a dedicated full-text endpoint for
articles.

---

## Listings (hotels, restaurants, …)

`GET /hotels` and `GET /restaurants` accept an optional `searchQuery`
parameter. Internally:

1. The `Listing` entity has a denormalized lower-cased text column
   `fulltext_index` populated by a TypeORM lifecycle hook from
   `name + description + amenities[]` on every insert/update.
2. A generated `tsvector` column (`search_vector`) and a GIN index on
   it (`gin_listings_search_vector`) live alongside it for ranked
   full-text queries.
3. `ListingService.list` uses the GIN index when the query has
   meaningful content, falling back to a case-insensitive `ILIKE`
   against `fulltext_index` for short queries / partial-match cases.

### Example

```http
GET /hotels?searchQuery=mountain%20view&location_id=1&priceMax=20000
```

Behavior:

- ✅ `Mountain View Hotel`, `MOUNTAIN RESORT`, `Skardu Mountain
  Lodge` all match.
- ❌ `Hill Station` does not match `mountain` (no fuzzy matching).
- Results are filtered to active listings unless `onlyActive=false` is
  explicitly passed.
- Combined with the structured filters (`location_id`, `priceMax`,
  `rating`, `isFeatured`).

### Searchable fields

| Field | Source |
| --- | --- |
| `name` | `listings.name` |
| `description` | `listings.description` |
| `amenities` | flattened from `listings.amenities[]` |

The denormalization means callers don't need to construct multi-field
`OR`s; one column is enough.

---

## Articles

```
GET /articles/search?term=baltistan
GET /articles/search?term=baltistan&all=true
```

Same pattern — `articles.search_vector` is a `tsvector` over title +
excerpt + content. With `all=true` the response includes related
`locations`, `categories`, and `tags`.

Response:

```json
[
  {
    "article_id": 42,
    "title": "Top 10 Places to Visit in Baltistan",
    "slug": "top-10-places-baltistan",
    "excerpt": "...",
    "image_urls": ["https://cdn.example.com/image1.jpg"],
    "locations": [{ "id": 5, "name": "Skardu" }],
    "categories": [{ "category_id": 1, "name": "Adventure" }],
    "tags": ["travel", "mountains", "culture"]
  }
]
```

---

## Implementation notes

- **Lower-cased denormalization**: the `BeforeInsert/BeforeUpdate` hook
  on `Listing` lower-cases everything once, so query-time we don't
  need `LOWER(...)` (which would defeat the index).
- **GIN index**: created in the migration as
  `CREATE INDEX gin_listings_search_vector ON listings USING gin(search_vector)`.
- **Why not pure `ILIKE`?** Leading wildcards (`%term`) prevent
  B-tree index use; on a moderately-sized listings table that becomes
  a sequential scan very quickly. The GIN tsvector index gives us
  `O(matching docs)` instead.

---

## Future work

- Relevance ranking (`ts_rank_cd`) currently isn't surfaced in the API
  — results come back in `created_at DESC` order. Easy follow-up.
- Fuzzy matching: `pg_trgm` extension + similarity threshold could
  cover typos.
- Faceted aggregations (counts per location, per amenity) are not yet
  exposed.
