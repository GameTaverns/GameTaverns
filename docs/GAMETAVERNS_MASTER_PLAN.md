# GameTaverns.com - Multi-Tenant Platform Master Plan

## Executive Summary

Transform the single-tenant Game Haven board game library into **GameTaverns.com**, a multi-tenant SaaS platform where any user can create their own game library accessible via personal subdomains (e.g., `tzolak.gametaverns.com`).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLOUDFLARE                                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   DNS Proxy     │  │    Turnstile    │  │   SSL/TLS       │              │
│  │ *.gametaverns.com│  │  Bot Protection │  │  (Automatic)    │              │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘              │
└───────────┼────────────────────┼────────────────────┼───────────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HESTIACP SERVER                                    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         NGINX (Reverse Proxy)                        │    │
│  │  • Wildcard SSL for *.gametaverns.com                               │    │
│  │  • Route subdomains to Express API                                   │    │
│  │  • Serve static React build                                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│            │                              │                                  │
│            ▼                              ▼                                  │
│  ┌──────────────────────┐    ┌──────────────────────────────────────────┐   │
│  │   React Frontend     │    │           Express.js API                  │   │
│  │   (Static Build)     │    │                                          │   │
│  │                      │    │  ┌────────────────────────────────────┐  │   │
│  │  • Tenant detection  │    │  │     Tenant Middleware              │  │   │
│  │  • Dynamic theming   │    │  │  • Extract tenant from subdomain   │  │   │
│  │  • Library UI        │    │  │  • Set schema context              │  │   │
│  │  • Admin dashboard   │    │  │  • Inject tenant into requests     │  │   │
│  │                      │    │  └────────────────────────────────────┘  │   │
│  └──────────────────────┘    │                                          │   │
│                              │  ┌────────────────────────────────────┐  │   │
│                              │  │     Route Handlers                 │  │   │
│                              │  │  • /api/auth/* (tenant-aware)     │  │   │
│                              │  │  • /api/games/* (scoped)          │  │   │
│                              │  │  • /api/admin/* (platform admin)  │  │   │
│                              │  └────────────────────────────────────┘  │   │
│                              └──────────────┬───────────────────────────┘   │
│                                             │                                │
│                                             ▼                                │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        MariaDB Database                               │   │
│  │                                                                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │   │
│  │  │ gametaverns_core│  │ tenant_tzolak   │  │ tenant_bob      │       │   │
│  │  │                 │  │                 │  │                 │       │   │
│  │  │ • tenants       │  │ • games         │  │ • games         │       │   │
│  │  │ • users         │  │ • publishers    │  │ • publishers    │       │   │
│  │  │ • subscriptions │  │ • mechanics     │  │ • mechanics     │       │   │
│  │  │ • platform_cfg  │  │ • sessions      │  │ • sessions      │       │   │
│  │  └─────────────────┘  │ • wishlist      │  │ • wishlist      │       │   │
│  │                       │ • messages      │  │ • messages      │       │   │
│  │                       │ • ratings       │  │ • ratings       │       │   │
│  │                       │ • settings      │  │ • settings      │       │   │
│  │                       └─────────────────┘  └─────────────────┘       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                     HestiaCP Mail Server                              │   │
│  │  • Per-tenant email routing                                          │   │
│  │  • Contact form delivery to tenant owner                             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
            │                              │
            ▼                              ▼
┌──────────────────────┐    ┌──────────────────────┐
│      iOS App         │    │     Android App      │
│                      │    │                      │
│  • Subdomain login   │    │  • Subdomain login   │
│  • Library browsing  │    │  • Library browsing  │
│  • Push notifications│    │  • Push notifications│
└──────────────────────┘    └──────────────────────┘
```

---

## User Roles & Access Matrix

| Role | Scope | Capabilities |
|------|-------|--------------|
| **Platform Admin** | Global | Manage all tenants, view analytics, platform settings, billing |
| **Tenant Owner** | Their library | Full control of their library, settings, theme, users |
| **Tenant Admin** | Their library | Manage games, view messages, moderate |
| **Tenant Member** | Their library | View games, use wishlist, rate games (if allowed) |
| **Public Visitor** | Single library | Browse public games, contact seller, add to wishlist |

---

## Database Schema Design

### Core Schema: `gametaverns_core`

This schema contains platform-wide data shared across all tenants.

```sql
-- =============================================
-- CORE SCHEMA: Platform-wide tables
-- =============================================

CREATE SCHEMA IF NOT EXISTS gametaverns_core;

-- Tenant Registry
CREATE TABLE gametaverns_core.tenants (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    slug VARCHAR(63) NOT NULL UNIQUE,          -- Subdomain: 'tzolak' -> tzolak.gametaverns.com
    display_name VARCHAR(255) NOT NULL,        -- "Tzolak's Game Library"
    owner_id CHAR(36) NOT NULL,                -- References platform user
    schema_name VARCHAR(63) NOT NULL UNIQUE,   -- 'tenant_tzolak'
    
    -- Status
    status ENUM('pending', 'active', 'suspended', 'deleted') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- Settings stored as JSON
    settings JSON,                              -- Theme, features, etc.
    
    -- Limits (for future paid tiers)
    max_games INT DEFAULT 500,
    max_storage_mb INT DEFAULT 1000,
    
    INDEX idx_slug (slug),
    INDEX idx_owner (owner_id),
    INDEX idx_status (status)
);

-- Platform Users (can own/access multiple tenants)
CREATE TABLE gametaverns_core.users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    avatar_url VARCHAR(500),
    
    -- Platform role
    platform_role ENUM('user', 'admin', 'super_admin') DEFAULT 'user',
    
    -- Status
    email_verified BOOLEAN DEFAULT FALSE,
    status ENUM('active', 'suspended', 'deleted') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    
    INDEX idx_email (email),
    INDEX idx_status (status)
);

-- User-Tenant Memberships
CREATE TABLE gametaverns_core.tenant_members (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tenant_id CHAR(36) NOT NULL,
    user_id CHAR(36) NOT NULL,
    role ENUM('owner', 'admin', 'member') NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    invited_by CHAR(36),
    
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_membership (tenant_id, user_id)
);

-- Email Verification & Password Reset Tokens
CREATE TABLE gametaverns_core.auth_tokens (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    token_type ENUM('email_verify', 'password_reset', 'invite') NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token_hash),
    INDEX idx_expires (expires_at)
);

-- Platform Settings
CREATE TABLE gametaverns_core.platform_settings (
    key_name VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Audit Log (platform-wide actions)
CREATE TABLE gametaverns_core.audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id CHAR(36),
    tenant_id CHAR(36),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id CHAR(36),
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user (user_id),
    INDEX idx_tenant (tenant_id),
    INDEX idx_action (action),
    INDEX idx_created (created_at)
);
```

### Tenant Schema Template: `tenant_{slug}`

Each tenant gets their own isolated schema with these tables:

```sql
-- =============================================
-- TENANT SCHEMA TEMPLATE
-- Run this for each new tenant, replacing {slug}
-- =============================================

CREATE SCHEMA IF NOT EXISTS tenant_{slug};

-- Games (main content)
CREATE TABLE tenant_{slug}.games (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255),
    description TEXT,
    image_url VARCHAR(500),
    additional_images JSON,                    -- Array of URLs
    youtube_videos JSON,                       -- Array of video IDs
    
    -- Game details
    min_players TINYINT DEFAULT 1,
    max_players TINYINT DEFAULT 4,
    play_time ENUM('0-15 Minutes', '15-30 Minutes', '30-45 Minutes', 
                   '45-60 Minutes', '60+ Minutes', '2+ Hours', '3+ Hours'),
    difficulty ENUM('1 - Light', '2 - Medium Light', '3 - Medium', 
                    '4 - Medium Heavy', '5 - Heavy') DEFAULT '3 - Medium',
    game_type ENUM('Board Game', 'Card Game', 'Dice Game', 'Party Game', 
                   'War Game', 'Miniatures', 'RPG', 'Other') DEFAULT 'Board Game',
    suggested_age VARCHAR(20) DEFAULT '10+',
    
    -- BGG Integration
    bgg_id VARCHAR(20),
    bgg_url VARCHAR(500),
    
    -- Status flags
    is_expansion BOOLEAN DEFAULT FALSE,
    parent_game_id CHAR(36),
    is_for_sale BOOLEAN DEFAULT FALSE,
    sale_price DECIMAL(10,2),
    sale_condition ENUM('New/Sealed', 'Like New', 'Very Good', 'Good', 'Acceptable'),
    is_coming_soon BOOLEAN DEFAULT FALSE,
    
    -- Collection details
    sleeved BOOLEAN DEFAULT FALSE,
    upgraded_components BOOLEAN DEFAULT FALSE,
    crowdfunded BOOLEAN DEFAULT FALSE,
    in_base_game_box BOOLEAN DEFAULT FALSE,
    inserts BOOLEAN DEFAULT FALSE,
    
    -- Location
    location_room VARCHAR(100),
    location_shelf VARCHAR(100),
    location_misc VARCHAR(255),
    
    -- Publisher
    publisher_id CHAR(36),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_slug (slug),
    INDEX idx_title (title),
    INDEX idx_for_sale (is_for_sale),
    INDEX idx_expansion (is_expansion, parent_game_id),
    FULLTEXT idx_search (title, description)
);

-- Publishers
CREATE TABLE tenant_{slug}.publishers (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mechanics (tags for games)
CREATE TABLE tenant_{slug}.mechanics (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Game-Mechanic junction
CREATE TABLE tenant_{slug}.game_mechanics (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    game_id CHAR(36) NOT NULL,
    mechanic_id CHAR(36) NOT NULL,
    
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (mechanic_id) REFERENCES mechanics(id) ON DELETE CASCADE,
    UNIQUE KEY unique_game_mechanic (game_id, mechanic_id)
);

-- Game Sessions (play logs)
CREATE TABLE tenant_{slug}.game_sessions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    game_id CHAR(36) NOT NULL,
    played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_minutes INT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    INDEX idx_game (game_id),
    INDEX idx_played (played_at)
);

-- Session Players
CREATE TABLE tenant_{slug}.game_session_players (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    session_id CHAR(36) NOT NULL,
    player_name VARCHAR(100) NOT NULL,
    score INT,
    is_winner BOOLEAN DEFAULT FALSE,
    is_first_play BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE
);

-- Wishlist (visitor votes)
CREATE TABLE tenant_{slug}.game_wishlist (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    game_id CHAR(36) NOT NULL,
    guest_identifier VARCHAR(255) NOT NULL,    -- Cookie/fingerprint based
    guest_name VARCHAR(100),                   -- Optional name they provide
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    UNIQUE KEY unique_vote (game_id, guest_identifier)
);

-- Ratings (visitor ratings)
CREATE TABLE tenant_{slug}.game_ratings (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    game_id CHAR(36) NOT NULL,
    guest_identifier VARCHAR(255) NOT NULL,
    rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    ip_address VARCHAR(45),
    device_fingerprint VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    UNIQUE KEY unique_rating (game_id, guest_identifier)
);

-- Contact Messages
CREATE TABLE tenant_{slug}.game_messages (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    game_id CHAR(36) NOT NULL,
    sender_name_encrypted TEXT,                -- Encrypted PII
    sender_email_encrypted TEXT,
    message_encrypted TEXT,
    sender_ip_encrypted TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    INDEX idx_unread (is_read, created_at)
);

-- Admin-only game data (purchase info)
CREATE TABLE tenant_{slug}.game_admin_data (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    game_id CHAR(36) NOT NULL UNIQUE,
    purchase_price DECIMAL(10,2),
    purchase_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- Tenant Settings (per-library config)
CREATE TABLE tenant_{slug}.settings (
    key_name VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Feature Flags (per-library)
CREATE TABLE tenant_{slug}.feature_flags (
    key_name VARCHAR(100) PRIMARY KEY,
    enabled BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =============================================
-- VIEWS for common queries
-- =============================================

CREATE VIEW tenant_{slug}.games_public AS
SELECT 
    id, title, slug, description, image_url, additional_images, youtube_videos,
    min_players, max_players, play_time, difficulty, game_type, suggested_age,
    bgg_id, bgg_url, is_expansion, parent_game_id, is_for_sale, sale_price,
    sale_condition, is_coming_soon, sleeved, upgraded_components, crowdfunded,
    in_base_game_box, inserts, location_room, location_shelf, location_misc,
    publisher_id, created_at, updated_at
FROM tenant_{slug}.games;

CREATE VIEW tenant_{slug}.game_ratings_summary AS
SELECT 
    game_id,
    COUNT(*) as rating_count,
    ROUND(AVG(rating), 2) as average_rating
FROM tenant_{slug}.game_ratings
GROUP BY game_id;

CREATE VIEW tenant_{slug}.game_wishlist_summary AS
SELECT 
    game_id,
    COUNT(*) as vote_count,
    COUNT(CASE WHEN guest_name IS NOT NULL THEN 1 END) as named_votes
FROM tenant_{slug}.game_wishlist
GROUP BY game_id;
```

---

## API Architecture

### Tenant Resolution Middleware

```typescript
// server/src/middleware/tenant.ts
import { Request, Response, NextFunction } from 'express';
import { db } from '../services/db';

export interface TenantContext {
  tenantId: string;
  slug: string;
  schemaName: string;
  displayName: string;
  settings: Record<string, any>;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

export async function tenantMiddleware(
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  // Extract subdomain from host
  const host = req.headers.host || '';
  const subdomain = extractSubdomain(host);
  
  // Skip for main domain (gametaverns.com) - platform routes
  if (!subdomain || subdomain === 'www' || subdomain === 'api') {
    return next();
  }
  
  try {
    // Look up tenant
    const [tenants] = await db.query(
      'SELECT id, slug, schema_name, display_name, settings, status ' +
      'FROM gametaverns_core.tenants WHERE slug = ? AND status = "active"',
      [subdomain]
    );
    
    if (!tenants.length) {
      res.status(404).json({ error: 'Library not found' });
      return;
    }
    
    const tenant = tenants[0];
    req.tenant = {
      tenantId: tenant.id,
      slug: tenant.slug,
      schemaName: tenant.schema_name,
      displayName: tenant.display_name,
      settings: JSON.parse(tenant.settings || '{}'),
    };
    
    next();
  } catch (error) {
    console.error('Tenant resolution error:', error);
    res.status(500).json({ error: 'Failed to resolve library' });
  }
}

function extractSubdomain(host: string): string | null {
  // Remove port if present
  const hostname = host.split(':')[0];
  
  // Check if it's a subdomain of gametaverns.com
  const match = hostname.match(/^([^.]+)\.gametaverns\.com$/i);
  if (match) {
    return match[1].toLowerCase();
  }
  
  // For local development: tenant.localhost
  const localMatch = hostname.match(/^([^.]+)\.localhost$/i);
  if (localMatch) {
    return localMatch[1].toLowerCase();
  }
  
  return null;
}
```

### Scoped Database Queries

```typescript
// server/src/services/db.ts
import mariadb from 'mariadb';
import { TenantContext } from '../middleware/tenant';

const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'gametaverns_core',
  connectionLimit: 20,
});

export const db = {
  query: (sql: string, params?: any[]) => pool.query(sql, params),
  
  // Tenant-scoped query helper
  tenantQuery: async (tenant: TenantContext, sql: string, params?: any[]) => {
    // Replace {schema} placeholder with actual tenant schema
    const scopedSql = sql.replace(/{schema}/g, tenant.schemaName);
    return pool.query(scopedSql, params);
  },
};

// Example usage in route:
// await db.tenantQuery(req.tenant, 'SELECT * FROM {schema}.games WHERE id = ?', [gameId]);
```

### Route Structure

```
/api
├── /platform              # Platform-wide routes (main domain only)
│   ├── POST /signup       # Create account + first library
│   ├── POST /login        # Platform login
│   ├── GET /me            # Current user + their tenants
│   ├── POST /tenants      # Create new library
│   └── /admin             # Platform admin routes
│
├── /auth                  # Tenant-scoped auth
│   ├── POST /login        # Login to specific library
│   ├── POST /logout
│   └── GET /me            # Current user in tenant context
│
├── /games                 # Tenant-scoped game routes
│   ├── GET /              # List games
│   ├── GET /:id           # Get game
│   ├── POST /             # Create game (admin)
│   ├── PUT /:id           # Update game (admin)
│   └── DELETE /:id        # Delete game (admin)
│
├── /bgg                   # BGG integration
│   ├── POST /lookup       # Search BGG
│   └── POST /import       # Import from BGG
│
├── /wishlist              # Guest wishlist
├── /ratings               # Guest ratings
├── /messages              # Contact messages
├── /sessions              # Play logs
└── /settings              # Tenant settings (admin)
```

---

## Frontend Architecture

### Tenant Detection in React

```typescript
// src/hooks/useTenant.ts
import { useEffect, useState } from 'react';

interface TenantInfo {
  slug: string;
  isPlatform: boolean;  // true if on main gametaverns.com
  apiUrl: string;
}

export function useTenant(): TenantInfo {
  const [tenant, setTenant] = useState<TenantInfo>(() => {
    const hostname = window.location.hostname;
    
    // Check for subdomain
    const match = hostname.match(/^([^.]+)\.gametaverns\.com$/i);
    const localMatch = hostname.match(/^([^.]+)\.localhost$/i);
    
    const slug = match?.[1] || localMatch?.[1] || null;
    const isPlatform = !slug || slug === 'www';
    
    return {
      slug: slug || '',
      isPlatform,
      apiUrl: isPlatform 
        ? 'https://api.gametaverns.com' 
        : `https://${slug}.gametaverns.com/api`,
    };
  });
  
  return tenant;
}
```

### Dual-Mode App

```typescript
// src/App.tsx
function App() {
  const { isPlatform, slug } = useTenant();
  
  if (isPlatform) {
    // Main gametaverns.com - marketing, signup, dashboard
    return <PlatformApp />;
  }
  
  // Tenant subdomain - game library
  return <LibraryApp tenantSlug={slug} />;
}
```

---

## Testing on Lovable (Before HestiaCP)

We can test multi-tenancy in this Lovable project by:

1. **Simulating subdomains with query params**: `?tenant=tzolak`
2. **Building the tenant middleware** to check query param OR subdomain
3. **Creating test tenants** in the database
4. **Testing isolation** between tenants

### Test Mode Configuration

```typescript
// For Lovable testing, we'll accept ?tenant=slug as alternative to subdomain
function extractTenant(req: Request): string | null {
  // Check query param first (for Lovable testing)
  if (req.query.tenant) {
    return String(req.query.tenant).toLowerCase();
  }
  
  // Then check subdomain (for production)
  return extractSubdomain(req.headers.host || '');
}
```

---

## Mobile App Architecture

### Subdomain-Based Login Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     GameTaverns Mobile App                       │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Library Selection                        │ │
│  │                                                            │ │
│  │   Enter your library address:                              │ │
│  │   ┌──────────────────────────────────────────────────────┐ │ │
│  │   │  tzolak                      .gametaverns.com       │ │ │
│  │   └──────────────────────────────────────────────────────┘ │ │
│  │                                                            │ │
│  │   [  Continue  ]                                          │ │
│  │                                                            │ │
│  │   ─────────────── or ───────────────                      │ │
│  │                                                            │ │
│  │   [  Create New Library  ]                                │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           ↓                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Login to Library                         │ │
│  │                                                            │ │
│  │   Tzolak's Game Library                                    │ │
│  │                                                            │ │
│  │   Email:    [________________________]                     │ │
│  │   Password: [________________________]                     │ │
│  │                                                            │ │
│  │   [  Sign In  ]                                           │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           ↓                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                    Library Browser                          │ │
│  │                                                            │ │
│  │   (Same UI as web, optimized for mobile)                  │ │
│  │                                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Capacitor Configuration

```typescript
// capacitor.config.ts
const config: CapacitorConfig = {
  appId: 'com.gametaverns.app',
  appName: 'GameTaverns',
  webDir: 'dist',
  server: {
    // In production, this would be empty (use bundled app)
    // For development, point to your test library
    url: 'https://tzolak.gametaverns.com',
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};
```

---

## Deployment Phases

### Phase 1: Database & Core (Week 1-2)
- [ ] Create MariaDB schema migration scripts
- [ ] Build tenant resolution middleware
- [ ] Implement platform auth (signup, login)
- [ ] Implement tenant creation flow
- [ ] Test on Lovable with query param tenants

### Phase 2: API Migration (Week 2-3)
- [ ] Migrate all routes to tenant-scoped queries
- [ ] Update Express routes for multi-tenancy
- [ ] Implement tenant settings/theming
- [ ] Add platform admin routes
- [ ] Email integration with HestiaCP mail

### Phase 3: Frontend (Week 3-4)
- [ ] Split into Platform + Library apps
- [ ] Build platform homepage/marketing
- [ ] Build tenant creation wizard
- [ ] Update all components for tenant context
- [ ] Implement tenant theming

### Phase 4: HestiaCP Deploy (Week 4-5)
- [ ] Set up HestiaCP domain
- [ ] Configure wildcard SSL
- [ ] Deploy database
- [ ] Deploy API
- [ ] Deploy frontend
- [ ] Configure Cloudflare

### Phase 5: Mobile Apps (Week 5-6)
- [ ] Complete Capacitor setup
- [ ] Implement subdomain login flow
- [ ] iOS build + TestFlight
- [ ] Android build + Play Console
- [ ] Push notifications

---

## File Checklist

### New Files to Create

```
server/
├── src/
│   ├── middleware/
│   │   └── tenant.ts              # Tenant resolution
│   ├── routes/
│   │   └── platform.ts            # Platform routes (signup, tenant mgmt)
│   ├── services/
│   │   ├── tenant.ts              # Tenant CRUD operations
│   │   ├── email.ts               # HestiaCP mail integration
│   │   └── mariadb.ts             # MariaDB connection pool
│   └── scripts/
│       ├── create-tenant.ts       # Script to create new tenant schema
│       └── migrate-to-mariadb.ts  # Migration from Postgres

src/
├── apps/
│   ├── platform/                  # Main gametaverns.com app
│   │   ├── pages/
│   │   │   ├── Home.tsx          # Marketing homepage
│   │   │   ├── Signup.tsx        # Account creation
│   │   │   ├── Dashboard.tsx     # User's libraries list
│   │   │   └── CreateLibrary.tsx # New library wizard
│   │   └── components/
│   │
│   └── library/                   # Tenant library app (current app, refactored)
│       ├── pages/
│       └── components/
│
├── contexts/
│   └── TenantContext.tsx          # Tenant context provider
│
└── hooks/
    └── useTenant.ts               # Tenant detection hook

deploy/
├── hestiacp/
│   ├── README.md                  # HestiaCP setup guide
│   ├── nginx-wildcard.conf        # Wildcard SSL config
│   ├── install.sh                 # One-line installer
│   └── cloudflare-dns.md          # Cloudflare setup guide
│
└── mariadb/
    ├── 00-core-schema.sql         # Core schema
    ├── 01-tenant-template.sql     # Tenant schema template
    └── 02-migrate-postgres.sql    # Migration from current Postgres
```

---

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| **Tenant data isolation** | Separate schemas + schema name in all queries |
| **Cross-tenant access** | Middleware enforces tenant context; no cross-schema joins |
| **SQL injection** | Parameterized queries; schema names validated against whitelist |
| **Subdomain spoofing** | Tenant slug validation; DNS controlled by Cloudflare |
| **PII protection** | Continue using encryption for messages |
| **Rate limiting** | Per-tenant rate limits |
| **Abuse prevention** | Turnstile on signup; email verification required |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Tenant creation time | < 30 seconds |
| Page load time | < 2 seconds |
| API response time | < 200ms (p95) |
| Uptime | 99.9% |
| Mobile app rating | 4.5+ stars |

---

## Next Steps

1. **Review this plan** - Confirm architecture decisions
2. **Start database schema** - Create MariaDB migration scripts
3. **Build tenant middleware** - Test with query param on Lovable
4. **Create HestiaCP docs** - Deployment guide

Ready to proceed with implementation!
