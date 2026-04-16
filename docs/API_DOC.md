
# API Documentation

This document describes all available API routes in the application, including headers, request, and response structures.

---

## Hotels

### Get All Hotels (Paginated & Search)
**GET** `/hotels`

#### Query Parameters
| Name        | Type   | Required | Description                        |
|-------------|--------|----------|------------------------------------|
| page        | number | No       | Page number (default: 1)           |
| limit       | number | No       | Items per page (default: 10)       |
| searchQuery | string | No       | Search by hotel name/description   |

#### Response
...existing code...

---

### Create Hotel
**POST** `/admin/hotels`

#### Headers
...existing code...

#### Request Body
...existing code...

#### Response
...existing code...

---

### Get Hotel By ID
**GET** `/admin/hotels/:id`

#### Headers

#### Response
...existing code...

---

### Update Hotel
**PUT** `/admin/hotels/:id`

#### Headers
...existing code...

#### Request Body
...existing code...

#### Response
...existing code...

---

### Delete Hotel
**DELETE** `/admin/hotels/:id`

#### Headers
...existing code...

#### Response
- Status: 204 No Content

---

### Toggle Hotel Ad Status
**POST** `/admin/hotels/:id/toggle-status`

#### Headers
| Name           | Value         | Required | Description         |
|----------------|--------------|----------|---------------------|
| Authorization  | Bearer token | Yes      | Admin access        |
| Content-Type   | application/json | Yes   |                     |

#### Request Body
```json
{
  "is_active": true
}
```

#### Response
```json
{
  "id": "string",
  "is_active": true,
  "...": "..."
}
```

---

### Renew Hotel Ad
**POST** `/admin/hotels/:id/renew`

#### Headers
| Name           | Value         | Required | Description         |
|----------------|--------------|----------|---------------------|
| Authorization  | Bearer token | Yes      | Admin access        |
| Content-Type   | application/json | Yes   |                     |

#### Request Body
```json
{
  "subscription_type": "PREMIUM"
}
```

#### Response
```json
{
  "id": "string",
  "subscription_type": "PREMIUM",
  "...": "..."
}
```

---

### Get Expired Hotel Ads
**GET** `/admin/hotels/expired`

#### Headers
| Name           | Value         | Required | Description         |
|----------------|--------------|----------|---------------------|
| Authorization  | Bearer token | Yes      | Admin access        |

#### Response
```json
[
  { "id": "string", "...": "..." }
]
```

---

### Get Featured Hotel Ads
**GET** `/admin/hotels/featured`

#### Headers
| Name           | Value         | Required | Description         |
|----------------|--------------|----------|---------------------|
| Authorization  | Bearer token | Yes      | Admin access        |

#### Response
```json
[
  { "id": "string", "is_featured": true, "...": "..." }
]
```

---

### Get Premium Hotel Ads
**GET** `/admin/hotels/premium`

#### Headers
| Name           | Value         | Required | Description         |
|----------------|--------------|----------|---------------------|
| Authorization  | Bearer token | Yes      | Admin access        |

#### Response
```json
[
  { "id": "string", "subscription_type": "PREMIUM", "...": "..." }
]
```

---

### Get Hotel Ads by Vendor
**GET** `/admin/hotels/vendor/:vendorId`

#### Headers
| Name           | Value         | Required | Description         |
|----------------|--------------|----------|---------------------|
| Authorization  | Bearer token | Yes      | Admin access        |

#### Response
```json
[
  { "id": "string", "vendor_id": "string", "...": "..." }
]
```

---

### Set Hotel Featured Status
**POST** `/admin/hotels/:id/featured`

#### Headers
| Name           | Value         | Required | Description         |
|----------------|--------------|----------|---------------------|
| Authorization  | Bearer token | Yes      | Admin access        |
| Content-Type   | application/json | Yes   |                     |

#### Request Body
```json
{
  "is_featured": true
}
```

#### Response
```json
{
  "id": "string",
  "is_featured": true,
  "...": "..."
}
```

---

## Users

### Create User
**POST** `/users`

#### Request Body
```json
{
  "name": "string",
  "email": "string",
  "password": "string"
}
```

#### Response
```json
{
  "id": "string",
  "name": "string",
  "email": "string"
}
```

---

### Get All Users
**GET** `/users`

#### Response
```json
[
  { "id": "string", "name": "string", "email": "string" }
]
```

---

### Get User By ID
**GET** `/users/:id`

#### Response
```json
{
  "id": "string",
  "name": "string",
  "email": "string"
}
```

---

### Update User
**POST** `/users/:id`

#### Headers
| Name           | Value         | Required | Description         |
|----------------|--------------|----------|---------------------|
| Authorization  | Bearer token | Yes      | User access         |
| Content-Type   | application/json | Yes   |                     |

#### Request Body
```json
{
  "name": "string",
  "email": "string"
}
```

#### Response
```json
{
  "id": "string",
  "name": "string",
  "email": "string"
}
```

---

### Update User Password
**POST** `/users/password`

#### Headers
| Name           | Value         | Required | Description         |
|----------------|--------------|----------|---------------------|
| Authorization  | Bearer token | Yes      | User access         |
| Content-Type   | application/json | Yes   |                     |

#### Request Body
```json
{
  "currentPassword": "string",
  "newPassword": "string",
  "confirmPassword": "string"
}
```

#### Response
```json
{
  "message": "Password updated successfully"
}
```

---

### Forgot Password
**POST** `/users/forgot-password`

#### Request Body
```json
{
  "email": "string"
}
```

#### Response
```json
{
  "message": "Password reset email sent"
}
```

---

### Get Vendors
**GET** `/vendors`

#### Response
```json
[
  { "id": "string", "name": "string", "email": "string" }
]
```

---

### Get Customers
**GET** `/customers`

#### Response
```json
[
  { "id": "string", "name": "string", "email": "string" }
]
```

---

## Auth

### Register
**POST** `/auth/register`

#### Request Body
```json
{
  "name": "string",
  "email": "string",
  "password": "string"
}
```

#### Response
```json
{
  "id": "string",
  "name": "string",
  "email": "string"
}
```

---

### Login
**POST** `/auth/login`

#### Request Body
```json
{
  "email": "string",
  "password": "string"
}
```

#### Response
```json
{
  "accessToken": "string",
  "refreshToken": "string"
}
```

---

### Verify Email
**GET** `/auth/verify-email`

#### Query Parameters
| Name        | Type   | Required | Description                        |
|-------------|--------|----------|------------------------------------|
| token       | string | Yes      | Verification token                 |

#### Response
```json
{
  "message": "Email verified successfully"
}
```

---

### Resend Verification Email
**POST** `/auth/resend-verification-email`

#### Request Body
```json
{
  "email": "string"
}
```

#### Response
```json
{
  "message": "Verification email sent"
}
```

---

### Reset Password
**POST** `/auth/reset-password`

#### Request Body
```json
{
  "token": "string",
  "newPassword": "string"
}
```

#### Response
```json
{
  "message": "Password reset successfully"
}
```

---

---

## Articles

The Articles API handles blog posts, trip guides, and other content. It is a pure JSON API.

### Get All Articles
**GET** `/api/articles`
- Returns a paginated list of articles.

### Get Article by Slug
**GET** `/api/articles/:slug`
- Returns detailed article content.

### Create Article (Admin)
**POST** `/api/articles`
- Create a new article with JSON payload.
- See [Article API Usage Guide](file:///f:/GoFunoon/travelBaltistan/Khor-server/docs/ARTICLE_API_USAGE.md) for details.

### Update Article (Admin)
**PUT** `/api/articles/:id`
- Update existing article fields.
- Relationship syncing for locations and categories is supported.

### Delete Article (Admin)
**DELETE** `/api/articles/:id`

---

## Media & R2 Uploads

### Get Presigned URLs
**POST** `/api/media/presigned`
- Used for direct client-side uploads to R2.

---

<!-- Additional resources like ads, locations, etc. -->

