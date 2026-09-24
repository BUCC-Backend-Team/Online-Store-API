# Online Store API

REST API for a small online store. Customers sign up, browse products, and place orders. Admins manage the catalog, review every order, and move orders from paid to shipped.

Live base URL: [https://online-store-api-9wfq.onrender.com](https://online-store-api-9wfq.onrender.com)

All routes are under `/api`. Example: `https://online-store-api-9wfq.onrender.com/api/auth/login`

The service is hosted on Render. The first request after a period of inactivity can take longer while the instance wakes up.

## What it does

- Account signup and login with a JSON Web Token that lasts 7 days.
- Customer profiles, plus an admin view of every account.
- A product catalog identified by SKU, with stock and an active flag.
- Orders that lock product rows, decrement stock, and restore stock when cancelled.
- Order status moves only along `pending` → `paid` → `shipped`. `pending` and `paid` orders can be cancelled. Shipped orders cannot.

Signup always creates a `customer`. The first `admin` comes from the database seed, not from the signup endpoint.

## Stack

- Node.js and Express 5
- PostgreSQL through Prisma 5 (hosted on Supabase)
- Upstash Redis for rate limits
- Joi for request validation
- bcrypt for password hashes
- JSON Web Tokens for authentication

## Roles

| Role | Can do |
| --- | --- |
| `customer` | Read active products, place orders, read and cancel their own `pending` or `paid` orders, read and update their profile |
| `admin` | Create, update, and deactivate products, see inactive products, list every user, deactivate a user, list every order, read any order, cancel an order, mark an order `paid` or `shipped` |

An admin cannot place an order. A customer cannot create products or change order status. Deactivated accounts are rejected with `403`.

## Authentication

Protected routes expect:

```http
Authorization: Bearer <token>
```

Signup and login return the token in `data.token`. Passwords are stored as hashes and are never included in responses.

## Response shape

Success:

```json
{
  "success": true,
  "message": "Logged in successfully",
  "data": {}
}
```

Failure:

```json
{
  "success": false,
  "message": "Invalid email or password",
  "requestId": "..."
}
```

`404` with `{ "success": false, "message": "Route not found" }` means the path does not exist.

## Rate limits

| Limiter | Default | Applies to |
| --- | --- | --- |
| Auth | 10 requests per 15 minutes per IP | `POST /api/auth/signup` and `POST /api/auth/login` |
| General | 100 requests per 15 minutes per signed-in user | Every other route |

Responses include `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset`. A limit breach returns `429`. If Redis is unavailable, login and signup fail closed with `503`. Other routes continue.

## Endpoints

### Auth

#### `POST /api/auth/signup`

Creates a customer and returns a token. No authentication header.

```json
{
  "name": "Test User",
  "email": "tester@example.com",
  "password": "Testerpass1"
}
```

Rules: `name` is 2–50 characters. `email` must be a valid address (a `.local` domain is rejected). `password` must be at least 8 characters and include one uppercase letter, one lowercase letter, and one number.

`201` body: `data.user` (id, name, email, role, isActive, timestamps) and `data.token`.

`409` if the email is already registered.

#### `POST /api/auth/login`

```json
{
  "email": "tester@example.com",
  "password": "Testerpass1"
}
```

`200` with `data.user` and `data.token`. `401` for a wrong email or password. `403` if the account is deactivated.

### Users

All of these require a bearer token.

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/users/me` | Any signed-in user | Current profile |
| `PATCH` | `/api/users/me` | Any signed-in user | Update `name` and/or `email` |
| `GET` | `/api/users` | Admin | Every user, newest first |
| `GET` | `/api/users/:id` | Admin | One user by id |
| `DELETE` | `/api/users/:id` | Admin | Deactivate the account (`isActive: false`). The row stays so past orders remain valid |

`PATCH /api/users/me` must include at least one of `name` or `email`. `409` if the new email belongs to someone else.

### Products

Every product route requires a bearer token. Prices are decimal strings with two places, such as `"12.50"`.

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/products` | Admin | Create a product |
| `GET` | `/api/products` | Customer or admin | Paginated list |
| `GET` | `/api/products/:sku` | Customer or admin | One product |
| `PATCH` | `/api/products/:sku` | Admin | Update any subset of fields |
| `POST` | `/api/products/:sku/deactivate` | Admin | Set `isActive` to false |

Create body:

```json
{
  "sku": "MUG-001",
  "name": "Test Mug",
  "description": "Ceramic mug",
  "price": "12.50",
  "stockQuantity": 10,
  "isActive": true
}
```

`sku` is unique, 1–100 characters. `name` is 1–255 characters. `price` must be greater than 0 and at most `99999999.99`, with at most two decimal places. `stockQuantity` is an integer of 0 or more. `description` and `isActive` are optional. `isActive` defaults to `true`.

List query: `page` (default 1) and `limit` (default 20, max 100).

```http
GET /api/products?page=1&limit=20
```

List `data` is `{ products, page, limit, total }`. A single product is `data.product`.

Customers only receive products with `isActive: true`. An inactive SKU is `404` for a customer and still visible to an admin. `409` if a SKU is already taken.

### Orders

Every order route requires a bearer token. Product ids are UUIDs from the product `id` field, not the SKU.

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/orders` | Customer | Place an order |
| `GET` | `/api/orders` | Customer or admin | Customer: their orders. Admin: every order |
| `GET` | `/api/orders/:id` | Customer or admin | One order. A customer can only read their own |
| `POST` | `/api/orders/:id/cancel` | Customer or admin | Cancel a `pending` or `paid` order and restore stock |
| `PATCH` | `/api/orders/:id/status` | Admin | Move `pending` → `paid`, or `paid` → `shipped` |

Place an order:

```json
{
  "items": [
    { "productId": "57e038d5-73f0-45c5-a74d-a002ed6c3ed4", "quantity": 2 }
  ]
}
```

At least one item is required. Each product may appear once. Quantity is an integer of 1 or more.

The order is created as `pending`. The unit price is copied from the product at purchase time. Stock is decremented inside a transaction. Inactive products and insufficient stock return `409`. A missing product returns `404`.

Order `data.order` (and each entry in `data.orders`) looks like:

```json
{
  "id": "uuid",
  "userId": "uuid",
  "status": "pending",
  "totalAmount": "25.00",
  "createdAt": "2026-09-24T22:00:00.000Z",
  "updatedAt": "2026-09-24T22:00:00.000Z",
  "items": [
    {
      "id": "uuid",
      "orderId": "uuid",
      "productId": "uuid",
      "quantity": 2,
      "unitPrice": "12.50"
    }
  ]
}
```

Status update body. Only these two values are accepted:

```json
{ "status": "paid" }
```

```json
{ "status": "shipped" }
```

`409` if the order is not in the required previous status, or if a shipped order is cancelled.

## Local setup

Requirements: Node.js 18 or newer, a PostgreSQL database, and an Upstash Redis database.

```bash
npm install
cp .env.example .env
```

Fill in `.env`. Then apply the schema and create the admin:

```bash
npx prisma migrate deploy
npx prisma db seed
npm start
```

The API listens on `PORT`, or `3000` if `PORT` is unset. Local base URL: `http://localhost:3000/api`.

### Environment variables

| Variable | Required at runtime | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string. Use the Supabase session pooler (`aws-1-<region>.pooler.supabase.com`, port `5432`) with `sslmode=require`. The direct `db.<ref>.supabase.co` host is IPv6-only and will not connect from a machine or host that has no IPv6 route |
| `JWT_SECRET` | Yes | Secret used to sign tokens |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis REST token |
| `PORT` | No | Listen port. Render sets this. Do not force `3000` in production |
| `RATE_LIMIT_MAX` | No | General limit. Default `100` |
| `RATE_LIMIT_WINDOW_MS` | No | General window. Default `900000` (15 minutes) |
| `AUTH_RATE_LIMIT_MAX` | No | Auth limit. Default `10` |
| `AUTH_RATE_LIMIT_WINDOW_MS` | No | Auth window. Default `900000` |
| `ADMIN_EMAIL` | Seed only | Admin email. Must be an address Joi accepts, such as `admin@example.com` |
| `ADMIN_PASSWORD` | Seed only | Admin password. Hashed before it is stored |
| `ADMIN_NAME` | Seed only | Admin display name |

Do not commit `.env`.

`npx prisma db seed` upserts one admin from those three variables. Running it again does not reset the password of an admin that already exists.

## Deploying on Render

Root directory: leave blank. The app lives at the repository root, not in `src`.

Build command:

```bash
npm install --include=dev && npx prisma generate && npx prisma migrate deploy
```

Start command:

```bash
npm start
```

`--include=dev` is required because the Prisma CLI is a dev dependency, and Render installs with `NODE_ENV=production`.

Set `DATABASE_URL`, `JWT_SECRET`, `UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` on the Render service. `prisma migrate deploy` reads `DATABASE_URL` during the build. It applies only migrations that are not already recorded, so it will not rebuild tables that already exist.

Copy the rate-limit variables if you want the same limits as local development. Leave `PORT` unset. The admin seed variables are not needed on Render once the admin user exists in the database.

## Walkthrough

1. Log in as the seeded admin: `POST /api/auth/login`.
2. Create a product: `POST /api/products`. Save `data.product.id`.
3. Sign up a customer: `POST /api/auth/signup`.
4. Place an order as that customer: `POST /api/orders` with the product id.
5. As the admin, `PATCH /api/orders/:id/status` with `"paid"`, then again with `"shipped"`.
6. Place a second order and `POST /api/orders/:id/cancel` while it is still `pending`. Stock for that quantity comes back.

## Project layout

```text
prisma/schema.prisma          Database models
prisma/migrations/            SQL migrations
prisma/seed.js                Creates the admin user
src/server.js                 Process entry
src/app.js                    Express app and error handling
src/routes/index.js           Mounts /auth, /users, /products, /orders
src/modules/users/            Signup, login, profiles
src/modules/product/          Catalog
src/modules/order/            Checkout, cancel, status
src/middleware/               Auth, roles, validation, rate limits
src/validations/              Joi schemas
```
