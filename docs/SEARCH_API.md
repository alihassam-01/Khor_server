# Search API Documentation

This document explains how the search functionality works across different resources in the Khor Server API.

## Overview

The API provides search endpoints for the following resources:
- **Room Types** (Rooms)
- **Properties** (Hotels, Car Rentals, Tours)
- **Tour Packages**
- **Articles**

All search endpoints use **case-insensitive** pattern matching to find results.

---

## Search Endpoints

### 1. Room Types Search

**Endpoint:** `GET /room-types/search`

**Query Parameters:**
- `term` (string, required) - The search term to match against room type data

**Search Fields:**
- `name` - Room type name
- `description` - Room type description

**Example Request:**
```bash
GET /room-types/search?term=deluxe
```

**Response Example:**
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Deluxe King Room",
    "description": "Spacious room with king size bed and mountain view",
    "base_price": 15000,
    "max_occupancy": 2,
    "total_rooms": 10,
    "size_sqm": 35,
    "active": true,
    "property": {
      "id": "property-uuid-123",
      "name": "K2 Motel",
      "type": "hotel",
      "address": {
        "location": {
          "name": "Skardu",
          "parent": { "name": "Baltistan" }
        }
      }
    }
  }
]
```

**Additional Endpoint:**
- `GET /room-types/vendor/search?term=deluxe` - Search room types for vendors (includes listing prices)

---

### 2. Properties Search

**Endpoint:** `GET /properties/search`

**Query Parameters:**
- `term` (string, required) - The search term to match against property data

**Search Fields:**
- `name` - Property name
- `description` - Property description
- `type` - Property type (exact match for: "hotel", "car_rental", "tour")

**Example Request:**
```bash
GET /properties/search?term=mountain
```

**Response Example:**
```json
[
  {
    "id": "prop-uuid-789",
    "name": "Mountain View Resort",
    "description": "Luxury resort with panoramic views of the Karakoram range",
    "type": "hotel",
    "active": true,
    "vendor": {
      "id": "vendor-uuid-456",
      "business_name": "Baltistan Tourism Co"
    },
    "address": {
      "street_address": "Main Road",
      "location": {
        "name": "Hunza",
        "location_id": 101
      }
    }
  }
]
```

**Special Behavior:**
If the search term exactly matches one of the allowed property types ("hotel", "car_rental", "tour"), it will also search by type.

---

### 3. Tour Packages Search

**Endpoint:** `GET /tour-packages/search`

**Query Parameters:**
- `term` (string, required) - The search term to match against tour package data

**Search Fields:**
- `name` - Tour package name
- `description` - Tour package description

**Example Request:**
```bash
GET /tour-packages/search?term=adventure
```

**Response Example:**
```json
[
  {
    "id": "tour-uuid-321",
    "name": "K2 Base Camp Adventure",
    "description": "14-day trekking adventure to the base of K2",
    "duration_days": 14,
    "price": 250000,
    "difficulty_level": "hard",
    "active": true,
    "property": {
      "id": "prop-uuid-555",
      "name": "Adventure Tours Ltd"
    },
    "destinations": [
      { "name": "Skardu", "location_id": 10 },
      { "name": "Askole", "location_id": 15 }
    ]
  }
]
```

---

### 4. Articles Search

**Endpoint:** `GET /articles/search`

**Query Parameters:**
- `term` (string, required) - The search term to match against article data

**Search Fields:**
- `title` - Article title
- `excerpt` - Article excerpt
- `content` - Article content

**Example Request:**
```bash
GET /articles/search?term=baltistan
```

**Response Example:**
```json
[
  {
    "article_id": 42,
    "title": "Top 10 Places to Visit in Baltistan",
    "slug": "top-10-places-baltistan",
    "excerpt": "Discover the hidden gems of Baltistan region...",
    "content": "Full article content here...",
    "published_at": "2024-05-15T10:00:00.000Z",
    "image_urls": ["https://cdn.example.com/image1.jpg"],
    "location": {
      "location_id": 5,
      "name": "Baltistan",
      "city": "Skardu"
    },
    "tags": ["travel", "mountains", "culture"]
  }
]
```

---

## How Search Works

### Pattern Matching

All searches use **case-insensitive LIKE** queries with wildcards:
```
ILIKE '%term%'
```

This means:
- ✅ Partial matches are supported
- ✅ Case doesn't matter ("Hotel" matches "hotel", "HOTEL", etc.)
- ✅ The term can appear anywhere in the field

### Examples

If searching for `term=mountain`:
- ✅ Matches: "Mountain View Hotel"
- ✅ Matches: "Hotel in the mountains"
- ✅ Matches: "MOUNTAIN RESORT"
- ❌ Does not match: "Hill Station"

### Multiple Field Search

Each endpoint searches across multiple fields using **OR** logic:
- If the term matches **any** of the search fields, the result is included
- Results are not ranked by relevance

---

## Implementation Details

### Technology
- **ORM:** TypeORM
- **Database:** PostgreSQL
- **Search Operator:** `ILike` (case-insensitive LIKE)

### Query Structure

All search methods follow this pattern:

```typescript
async search(term: string) {
  return this.repository.find({
    where: [
      { field1: ILike(`%${term}%`) },
      { field2: ILike(`%${term}%`) },
      { field3: ILike(`%${term}%`) },
    ],
    relations: ["relatedEntity"],
  });
}
```

### Performance Considerations

1. **Wildcards:** Leading wildcards (`%term`) prevent index usage
2. **Multiple Fields:** Each field is checked separately
3. **Relations:** Related entities are eagerly loaded

For better performance on large datasets, consider:
- Full-text search (PostgreSQL `tsvector`)
- Search indexes
- Pagination for results

---

## Error Handling

All search endpoints return:
- **200 OK** with results array (empty array if no matches)
- **400 Bad Request** if `term` parameter is missing
- **500 Internal Server Error** for database or server errors

---

## Best Practices

### For API Consumers

1. **URL Encode:** Always URL-encode the search term
   ```bash
   # Correct
   GET /properties/search?term=mountain%20view
   
   # Incorrect
   GET /properties/search?term=mountain view
   ```

2. **Minimum Length:** Consider requiring a minimum term length (e.g., 3 characters) to avoid overly broad searches

3. **Pagination:** For large result sets, combine with pagination parameters where available

### For Developers

1. **Validation:** Add input validation for the `term` parameter
2. **Sanitization:** The ORM handles SQL injection, but validate input length and characters
3. **Caching:** Consider caching common search queries
4. **Logging:** Log search terms for analytics and debugging

---

## Future Enhancements

Potential improvements to the search functionality:

1. **Full-Text Search:** Implement PostgreSQL full-text search for better performance
2. **Relevance Ranking:** Order results by relevance score
3. **Fuzzy Matching:** Support typo-tolerant searches
4. **Filters:** Combine search with additional filters (location, price range, etc.)
5. **Pagination:** Add limit/offset parameters for large result sets
6. **Highlighting:** Return matched text snippets with highlights

---

## Related Endpoints

### Alternative Filtering Methods

Some resources offer additional filtering options:

**Articles:**
- `GET /articles/list` - Supports filtering by:
  - `page` - Page number
  - `limit` - Results per page
  - `status` - Article status
  - `placeId` - Location ID
  - `categoryId` - Category ID
  - `tag` - Tag slug

**Properties:**
- `GET /properties/location/:locationId` - Filter by location

**Tour Packages:**
- `GET /tour-packages/location/:locationId` - Filter by location

**Room Types:**
- `GET /room-types/property/:propertyId` - Filter by property
- `GET /room-types/dates` - Filter by availability dates

---