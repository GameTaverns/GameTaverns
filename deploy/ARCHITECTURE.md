# Game Haven - Self-Hosted Architecture Specification

## Overview

Game Haven supports **two deployment modes**:

1. **Lovable Cloud** - Uses Supabase (managed by Lovable)
2. **Self-Hosted** - Uses simplified Node.js/Express backend with PostgreSQL

This document covers the self-hosted architecture.

---

## Architecture Comparison

| Component | Lovable Cloud | Self-Hosted |
|-----------|--------------|-------------|
| **Database** | Supabase Postgres | Standard PostgreSQL |
| **Auth** | GoTrue (Supabase Auth) | JWT + bcrypt (Express) |
| **API** | PostgREST + Edge Functions | Express.js REST API |
| **Gateway** | Kong | Express routing |
| **Realtime** | Supabase Realtime | (Optional) Socket.io |
| **Containers** | N/A (managed) | 3 (App, API, Postgres) |

---

## Self-Hosted Stack

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   Frontend   │  │  Express API │  │  PostgreSQL  │   │
│  │   (Nginx)    │──│   (Node.js)  │──│   Database   │   │
│  │   Port 80    │  │   Port 3001  │  │   Port 5432  │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│         │                  │                             │
│         │                  │                             │
│         ▼                  ▼                             │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Optional Services                    │   │
│  │  • Redis (sessions/cache)                        │   │
│  │  • AI Provider (BYOK: OpenAI/Gemini)             │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Database Schema

The self-hosted version uses the **same schema** as Lovable Cloud, but without RLS policies (security is handled at the API layer).

### Core Tables

```sql
-- Users (replaces auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Roles
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'user')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- All other tables remain the same (games, publishers, mechanics, etc.)
-- But foreign keys to auth.users are replaced with users table
```

### Migration from Supabase

For users migrating from Supabase Cloud to self-hosted:

```sql
-- Export users from auth.users
INSERT INTO users (id, email, password_hash, created_at)
SELECT id, email, encrypted_password, created_at
FROM auth.users;

-- user_roles table structure is identical
```

---

## Authentication System

### Self-Hosted Auth Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│  API     │────▶│ Database │
│          │◀────│ (JWT)    │◀────│          │
└──────────┘     └──────────┘     └──────────┘

1. POST /api/auth/login {email, password}
2. API validates password with bcrypt
3. API returns JWT token (24h expiry)
4. Client stores token in localStorage
5. All API requests include Authorization header
```

### JWT Token Structure

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "admin",
  "iat": 1234567890,
  "exp": 1234654290
}
```

### Password Requirements

- Minimum 8 characters
- Hashed with bcrypt (cost factor 12)
- No password storage in plain text

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new user |
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/logout` | Invalidate token |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/change-password` | Change password |

### Games

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/games` | List all games |
| GET | `/api/games/:id` | Get game by ID |
| POST | `/api/games` | Create game (admin) |
| PUT | `/api/games/:id` | Update game (admin) |
| DELETE | `/api/games/:id` | Delete game (admin) |

### BGG Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bgg/lookup` | Search BGG by name |
| POST | `/api/bgg/import` | Import game from BGG ID |

### Wishlist

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wishlist` | Get user's wishlist |
| POST | `/api/wishlist` | Add to wishlist |
| DELETE | `/api/wishlist/:gameId` | Remove from wishlist |

### Ratings

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ratings` | Get user's ratings |
| POST | `/api/ratings` | Rate a game |
| GET | `/api/ratings/summary` | Get rating summaries |

### Messages (Contact Seller)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/messages` | Send message |
| GET | `/api/messages` | Get messages (admin) |
| PUT | `/api/messages/:id/read` | Mark as read |

### Admin

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List users |
| POST | `/api/admin/users` | Create user |
| PUT | `/api/admin/users/:id` | Update user |
| DELETE | `/api/admin/users/:id` | Delete user |
| POST | `/api/admin/condense` | AI description condensing |

### Image Proxy

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/image-proxy` | Proxy external images |

---

## Edge Function → Express Route Mapping

| Supabase Edge Function | Express Route | Notes |
|-----------------------|---------------|-------|
| `bgg-lookup` | `POST /api/bgg/lookup` | Rate limited (10/min) |
| `bgg-import` | `POST /api/bgg/import` | Admin only |
| `bulk-import` | `POST /api/bgg/bulk-import` | Admin only |
| `game-import` | `POST /api/games/import` | Admin only |
| `image-proxy` | `GET /api/image-proxy` | Rate limited (100/min) |
| `send-message` | `POST /api/messages` | With Turnstile validation |
| `decrypt-messages` | N/A | Decryption happens in API |
| `rate-game` | `POST /api/ratings` | Rate limited |
| `wishlist` | `/api/wishlist/*` | Guest identifier based |
| `manage-users` | `/api/admin/users/*` | Admin only |
| `condense-descriptions` | `POST /api/admin/condense` | BYOK AI |
| `send-email` | Internal | Used by messages |

---

## AI Integration (BYOK)

Self-hosted users provide their own AI API key:

```env
# .env
AI_PROVIDER=openai  # or 'gemini'
AI_API_KEY=sk-your-api-key-here
```

### Supported Providers

1. **OpenAI** - GPT-4, GPT-3.5-turbo
2. **Google Gemini** - gemini-pro, gemini-flash
3. **Disabled** - AI features hidden if no key

The API automatically detects the provider from the key format.

---

## Environment Variables

### Required

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/gamehaven

# Security
JWT_SECRET=your-secure-random-string-min-32-chars
SESSION_SECRET=another-secure-random-string

# Site
SITE_NAME=Game Haven
SITE_URL=https://yourdomain.com
```

### Optional

```env
# AI (BYOK)
AI_PROVIDER=openai
AI_API_KEY=sk-...

# Email
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user
SMTP_PASS=pass
SMTP_FROM=noreply@example.com

# Security
TURNSTILE_SECRET_KEY=...
PII_ENCRYPTION_KEY=...

# Features
FEATURE_PLAY_LOGS=true
FEATURE_WISHLIST=true
FEATURE_FOR_SALE=true
FEATURE_MESSAGING=true
FEATURE_RATINGS=true
```

---

## Platform Support Matrix

| Platform | Support | Notes |
|----------|---------|-------|
| **Docker Compose** | ✅ Full | Primary target |
| **Ubuntu/Debian** | ✅ Full | One-liner installer |
| **Cloudron** | ✅ Full | Uses Cloudron PostgreSQL addon |
| **Softaculous** | ⚠️ Limited | Requires PHP proxy or container mode |
| **Windows** | 🟡 Via Docker | Docker Desktop or WSL2 |
| **macOS** | 🟡 Via Docker | Docker Desktop |

---

## Security Considerations

### Self-Hosted Security Checklist

- [ ] Use HTTPS in production (Let's Encrypt)
- [ ] Set strong JWT_SECRET (min 32 chars)
- [ ] Enable rate limiting
- [ ] Configure CORS for your domain only
- [ ] Use PII encryption for messages
- [ ] Regular database backups
- [ ] Keep containers updated

### Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/login` | 5 | 15 min |
| `/api/bgg/lookup` | 10 | 1 min |
| `/api/image-proxy` | 100 | 1 min |
| `/api/ratings` | 10 | 1 hour |
| `/api/messages` | 5 | 15 min |

---

## Upgrade Path

### From Supabase Cloud to Self-Hosted

1. Export database: `pg_dump` from Supabase
2. Modify auth tables (see Migration section)
3. Update environment variables
4. Deploy self-hosted stack
5. Import database
6. Update DNS

### From Self-Hosted to Lovable Cloud

1. Export database
2. Create Lovable Cloud project
3. Run migrations
4. Import data (excluding users table)
5. Re-create users via Supabase Auth

---

## File Structure

```
server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts           # Entry point
│   ├── app.ts             # Express app setup
│   ├── config.ts          # Environment config
│   ├── middleware/
│   │   ├── auth.ts        # JWT validation
│   │   ├── admin.ts       # Admin check
│   │   ├── rateLimit.ts   # Rate limiting
│   │   └── cors.ts        # CORS config
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── games.ts
│   │   ├── bgg.ts
│   │   ├── wishlist.ts
│   │   ├── ratings.ts
│   │   ├── messages.ts
│   │   ├── admin.ts
│   │   └── imageProxy.ts
│   ├── services/
│   │   ├── db.ts          # Database pool
│   │   ├── ai.ts          # AI provider
│   │   ├── email.ts       # SMTP
│   │   └── encryption.ts  # PII encryption
│   └── utils/
│       ├── jwt.ts
│       ├── password.ts
│       └── validation.ts
```

---

## Version History

- **v2.0.0** - Unified self-hosted architecture with Express.js
- **v1.x** - Supabase-based (Docker with full Supabase stack)
