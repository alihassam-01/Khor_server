# Article API Usage Guide

This document describes how to interact with the Article API. The API has been migrated to a **pure JSON-based architecture**. File uploads are handled client-side via presigned URLs, and the backend processes public URL strings.

---

## 1. Creating an Article

To create a new article, send a `POST` request with a JSON payload.

### Endpoint
```
POST /api/articles
Content-Type: application/json
```

### JSON Payload (Create)
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `title` | `string` | Yes | The full title of the article |
| `content` | `string` | Yes | The main content (Markdown supported) |
| `excerpt` | `string` | Yes | A short summary for cards/lists |
| `slug` | `string` | No | Auto-generated from title if omitted |
| `image_urls` | `string[]` | No | Array of public URLs for images |
| `location_ids` | `number[]` | No | IDs of attached locations (Many-to-Many) |
| `categories` | `number[]` | No | IDs of attached categories |
| `tags` | `string[]` | No | List of descriptive tags |
| `seo_title` | `string` | No | Meta title for SEO |
| `seo_description`| `string` | No | Meta description for SEO |
| `seo_keywords` | `string` | No | Comma-separated SEO keywords |
| `published_at` | `string` | No | ISO Date string (e.g., `"2024-04-15T..."`) |

### Example Request (JavaScript/TypeScript)
```javascript
const articleData = {
  title: "The Magic of Deosai",
  excerpt: "Exploring the roof of the world...",
  content: "### Welcome to Deosai...",
  location_ids: [5, 12], // Multi-location link
  categories: [1, 3],    // Category links
  tags: ["nature", "hiking"],
  image_urls: [
    "https://your-r2-domain.com/uploads/deosai-1.jpg",
    "https://your-r2-domain.com/uploads/deosai-2.jpg"
  ]
};

const response = await fetch('/api/articles', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(articleData)
});

const result = await response.json();
```

---

## 2. Updating an Article

To update an article, send a `PUT` request with only the fields you wish to change.

### Endpoint
```
PUT /api/articles/:id
Content-Type: application/json
```

### Important Notes on Updates:
- **Partial Updates**: You only need to send the fields that changed.
- **Relationship Sync**: When sending `location_ids` or `categories`, the backend will synchronize the relations (it will replace old links with the new list provided).
- **Images**: To update images, provide the complete list of desired `image_urls`. If you want to keep existing images and add new ones, you must send the existing URLs along with the new ones.

### Example Request
```javascript
// Example: Adding a new image and updating the title
const updatePayload = {
  title: "Deosai: Updated Title",
  image_urls: [
    "https://old-image.jpg", // Kept
    "https://newly-uploaded-image.jpg" // Added
  ]
};

await fetch(`/api/articles/${articleId}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(updatePayload)
});
```

---

## 3. Image Upload Workflow

The Article API no longer accepts raw file uploads (`multipart/form-data`). Instead, follow this two-step process:

1.  **Frontend**: Upload the raw image file directly to Cloudflare R2 using a **Presigned URL** (fetched from `/api/media/presigned`).
2.  **Backend**: Once you receive the final public URL from the R2 upload, send that URL string in the `image_urls` array of your `POST` or `PUT` article request.

> [!NOTE]
> There is no longer a hard limit on the number of images per article, but we recommend keeping it within reasonable limits (e.g., 1-10) for performance.

---

## 4. Response Format

All successful creation/update requests return the complete article object:

```json
{
  "article_id": 42,
  "title": "The Magic of Deosai",
  "slug": "the-magic-of-deosai",
  "excerpt": "Exploring the roof of the world...",
  "content": "### Welcome to Deosai...",
  "published_at": "2024-04-15T09:00:00.000Z",
  "image_urls": [
    "https://your-r2-domain.com/uploads/deosai-1.jpg"
  ],
  "locations": [
    { "id": 5, "name": "Deosai National Park" }
  ],
  "categories": [
    { "category_id": 1, "name": "Adventure" }
  ],
  "tags": ["nature", "hiking"]
}
```

---

## 5. Error Handling

### Common Error Codes
- `400 Bad Request`: Validation failed (missing required title/content, invalid ID formats).
- `404 Not Found`: The specified article, location, or category does not exist.
- `500 Server Error`: Database connection issues or unexpected internal failures.

### Example Error Response
```json
{
  "message": "Title is required",
  "error": "Bad Request",
  "statusCode": 400
}
```
