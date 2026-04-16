# Article API Usage Guide

This document describes how to interact with the Article API. The API has been migrated to a **pure JSON-based architecture**. File uploads are handled client-side via presigned URLs, and the backend processes public URL strings.

---

## 1. Fetching Articles (Public)

### List Articles (Paginated)
Get a list of articles with optional filtering.

**Endpoint**
```
GET /api/articles/list
```

**Query Parameters**
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `page` | `number` | Page number (default: 1) |
| `limit` | `number` | Items per page (default: 10) |
| `status` | `string` | Filter by status (`published`, `draft`) |
| `placeId` | `number` | Filter by location ID |
| `categoryId` | `number` | Filter by category ID |
| `tag` | `string` | Filter by specific tag |

---

### Get Single Article
Retrieve full details of an article.

**Endpoints**
```
GET /api/articles/:slug
GET /api/articles/id/:id
```

---

## 2. Managing Articles (Admin)

> [!IMPORTANT]
> All management endpoints (`POST`, `PUT`, `DELETE`) require a valid **Admin Bearer Token** in the `Authorization` header.

### Creating an Article
**Endpoint**
```
POST /api/articles
Content-Type: application/json
```

**JSON Payload (Create)**
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `title` | `string` | Yes | The full title of the article |
| `content` | `string` | Yes | The main content (Markdown supported) |
| `excerpt` | `string` | Yes | A short summary for cards/lists |
| `location_ids` | `number[]` | No | IDs of attached locations (Many-to-Many) |
| `categories` | `number[]` | No | IDs of attached categories |
| `image_urls` | `string[]` | No | Array of public URLs for images |
| `tags` | `string[]` | No | List of descriptive tags |

---

## 3. Content Creation & Markdown Guide

The frontend (`DestinationDetails`) uses specific Markdown patterns to extract sidebar data and interactive widgets.

### A. Seasons (Best Time to Visit)
Use `H3` headers with the season name. The description follows directly below.
```markdown
### Spring
The valleys are filled with apricot blossoms and moderate temperatures.

### Summer
Perfect for trekking...
```

### B. Things to Do (Activities)
Format as a list with **Bold Titles**. An optional *Italic* subtitle can be used at the top.
```markdown
## Things to Do
*Exploring the wilderness...*

1. **Trekking**: High-altitude trails and base camps.
2. **Photography**: Surreal landscapes of the cold desert.
```

### C. Travel Tips & Info
Use GitHub-style alerts (Blockquotes + `[!TAG]`) to generate styled tip cards.
```markdown
> [!TIP]
> **Transport**: Best visited by 4x4 vehicles.

> [!CAUTION]
> Carry extra warm clothing even in summer.
```

---

## 4. Image Upload Workflow

The Article API no longer accepts raw file uploads (`multipart/form-data`).

1.  **Frontend**: Fetch a **Presigned URL** from `/api/media/presigned`.
2.  **Frontend**: Upload the file directly to R2 using that URL.
3.  **Backend**: Send the final public URL in the `image_urls` array of your JSON payload.

---

## 5. Response Format

```json
{
  "article_id": 42,
  "title": "The Magic of Deosai",
  "slug": "the-magic-of-deosai",
  "image_urls": ["..."],
  "locations": [{ "id": 5, "name": "Skardu" }],
  "categories": [{ "category_id": 1, "name": "Adventure" }],
  "tags": ["nature"]
}
```
