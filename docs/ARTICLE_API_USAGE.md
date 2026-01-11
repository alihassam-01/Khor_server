# Article API Usage with Image Uploads

## Creating an Article with Images

The article creation endpoint now accepts **multipart/form-data** with up to **3 image files**.

### Endpoint
```
POST /api/articles
Content-Type: multipart/form-data
```

### Frontend Example (JavaScript/TypeScript)

```javascript
async function createArticle(articleData, imageFiles) {
  const formData = new FormData();
  
  // Add text fields
  formData.append('title', articleData.title);
  formData.append('slug', articleData.slug);
  formData.append('excerpt', articleData.excerpt);
  formData.append('content', articleData.content);
  formData.append('seo_title', articleData.seo_title);
  formData.append('seo_description', articleData.seo_description);
  formData.append('seo_keywords', articleData.seo_keywords);
  formData.append('location_id', articleData.location_id);
  
  // Add published_at if provided
  if (articleData.published_at) {
    formData.append('published_at', articleData.published_at);
  }
  
  // Add tags (send as JSON string or comma-separated)
  if (articleData.tags && articleData.tags.length > 0) {
    formData.append('tags', JSON.stringify(articleData.tags));
    // OR: formData.append('tags', articleData.tags.join(','));
  }
  
  // Add image files (up to 3)
  if (imageFiles && imageFiles.length > 0) {
    imageFiles.slice(0, 3).forEach((file) => {
      formData.append('images', file);
    });
  }
  
  const response = await fetch('http://localhost:3000/api/articles', {
    method: 'POST',
    body: formData,
    // Don't set Content-Type header - browser will set it with boundary
  });
  
  return await response.json();
}
```

### React Example with File Input

```jsx
import { useState } from 'react';

function CreateArticleForm() {
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
    location_id: '',
    tags: [],
  });
  const [imageFiles, setImageFiles] = useState([]);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 3) {
      alert('Maximum 3 images allowed');
      setImageFiles(files.slice(0, 3));
    } else {
      setImageFiles(files);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const formDataToSend = new FormData();
    
    // Add all text fields
    Object.keys(formData).forEach(key => {
      if (key === 'tags') {
        formDataToSend.append('tags', JSON.stringify(formData.tags));
      } else if (formData[key]) {
        formDataToSend.append(key, formData[key]);
      }
    });
    
    // Add images
    imageFiles.forEach(file => {
      formDataToSend.append('images', file);
    });
    
    try {
      const response = await fetch('http://localhost:3000/api/articles', {
        method: 'POST',
        body: formDataToSend,
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Article created:', result);
        alert('Article created successfully!');
      } else {
        const error = await response.json();
        console.error('Error:', error);
        alert('Failed to create article: ' + error.message);
      }
    } catch (error) {
      console.error('Network error:', error);
      alert('Network error occurred');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label>Title:</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => setFormData({...formData, title: e.target.value})}
          required
        />
      </div>

      <div>
        <label>Slug:</label>
        <input
          type="text"
          value={formData.slug}
          onChange={(e) => setFormData({...formData, slug: e.target.value})}
          required
        />
      </div>

      <div>
        <label>Excerpt:</label>
        <textarea
          value={formData.excerpt}
          onChange={(e) => setFormData({...formData, excerpt: e.target.value})}
          required
        />
      </div>

      <div>
        <label>Content:</label>
        <textarea
          value={formData.content}
          onChange={(e) => setFormData({...formData, content: e.target.value})}
          rows={10}
          required
        />
      </div>

      <div>
        <label>Location ID:</label>
        <input
          type="number"
          value={formData.location_id}
          onChange={(e) => setFormData({...formData, location_id: e.target.value})}
          required
        />
      </div>

      <div>
        <label>Images (max 3):</label>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleImageChange}
        />
        {imageFiles.length > 0 && (
          <p>{imageFiles.length} file(s) selected</p>
        )}
      </div>

      <div>
        <label>SEO Title:</label>
        <input
          type="text"
          value={formData.seo_title}
          onChange={(e) => setFormData({...formData, seo_title: e.target.value})}
        />
      </div>

      <div>
        <label>SEO Description:</label>
        <textarea
          value={formData.seo_description}
          onChange={(e) => setFormData({...formData, seo_description: e.target.value})}
        />
      </div>

      <div>
        <label>SEO Keywords:</label>
        <input
          type="text"
          value={formData.seo_keywords}
          onChange={(e) => setFormData({...formData, seo_keywords: e.target.value})}
          placeholder="keyword1, keyword2, keyword3"
        />
      </div>

      <button type="submit">Create Article</button>
    </form>
  );
}

export default CreateArticleForm;
```

### cURL Example

```bash
curl -X POST http://localhost:3000/api/articles \
  -F "title=Hashu Pi Bagh" \
  -F "slug=hashu-pi-bagh" \
  -F "excerpt=Beautiful orchard in Shigar" \
  -F "content=Full article content here..." \
  -F "seo_title=Hashu Pi Bagh - Best Orchard" \
  -F "seo_description=Visit the beautiful Hashu Pi Bagh" \
  -F "seo_keywords=shigar,skardu,orchard,fruits" \
  -F "location_id=5" \
  -F "tags=[\"nature\",\"tourism\",\"orchard\"]" \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.jpg" \
  -F "images=@/path/to/image3.jpg"
```

## Updating an Article with Images

### Endpoint
```
PUT /api/articles/:id
Content-Type: multipart/form-data (for images) OR application/json (for text only)
```

### Frontend Example

```javascript
async function updateArticle(articleId, updates, newImageFiles) {
  // If no new images, can use JSON
  if (!newImageFiles || newImageFiles.length === 0) {
    const response = await fetch(`http://localhost:3000/api/articles/${articleId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });
    return await response.json();
  }
  
  // If uploading new images, use FormData
  const formData = new FormData();
  
  Object.keys(updates).forEach(key => {
    if (key === 'tags' && Array.isArray(updates[key])) {
      formData.append('tags', JSON.stringify(updates[key]));
    } else if (updates[key] !== undefined && updates[key] !== null) {
      formData.append(key, updates[key]);
    }
  });
  
  newImageFiles.slice(0, 3).forEach(file => {
    formData.append('images', file);
  });
  
  const response = await fetch(`http://localhost:3000/api/articles/${articleId}`, {
    method: 'PUT',
    body: formData,
  });
  
  return await response.json();
}
```

## Important Notes

1. **Maximum Images**: Up to 3 images per article
2. **Field Name**: Image files must use the field name `images` (not `image`)
3. **File Size Limit**: 5MB per file (configured in server)
4. **Supported Formats**: All image formats (jpg, png, webp, etc.)
5. **Storage**: Images are automatically uploaded to Cloudflare R2
6. **Image URLs**: Returned in the `image_urls` array in the response
7. **Tags Format**: Can be sent as JSON string `"[\"tag1\",\"tag2\"]"` or comma-separated `"tag1,tag2"`

## Response Format

```json
{
  "article_id": 1,
  "title": "Hashu Pi Bagh",
  "slug": "hashu-pi-bagh",
  "excerpt": "Beautiful orchard in Shigar",
  "content": "Full article content...",
  "published_at": null,
  "seo_title": "Hashu Pi Bagh - Best Orchard",
  "seo_keywords": "shigar,skardu,orchard,fruits",
  "seo_description": "Visit the beautiful Hashu Pi Bagh",
  "image_urls": [
    "https://your-r2-domain.com/uploads/abc-123.jpg",
    "https://your-r2-domain.com/uploads/def-456.jpg",
    "https://your-r2-domain.com/uploads/ghi-789.jpg"
  ],
  "location": {
    "location_id": 5,
    "name": "Shigar"
  },
  "tags": ["nature", "tourism", "orchard"]
}
```

## Error Handling

### No Images (Optional)
If no images are provided, the article will be created/updated without images. The `image_urls` field will be an empty array.

### Too Many Images
Only the first 3 images will be processed. Additional images are ignored.

### Upload Failures
If an image upload to R2 fails, the entire operation will fail and return an error.

```json
{
  "message": "Failed to upload file to R2"
}
```

### Missing Required Fields
```json
{
  "message": "Place not found"
}
```

## Migration from Old API

**Old Format (deprecated):**
```javascript
{
  "image_url": "https://external-url.com/image.jpg"
}
```

**New Format:**
```javascript
// Use FormData with file uploads
const formData = new FormData();
formData.append('images', fileObject);
```

The backend still accepts `image_url` for backward compatibility, but it's recommended to use the new multipart upload approach.
