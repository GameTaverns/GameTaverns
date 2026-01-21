# Game Haven - Cloudron Deployment with PocketBase

Self-contained deployment with frontend + PocketBase backend in a single container.

## Quick Start

```bash
cd deploy/cloudron
docker build -t your-registry/gamehaven:latest -f Dockerfile ../..
docker push your-registry/gamehaven:latest
cloudron install
```

## What's Included

- **Frontend**: React app served by Nginx
- **Backend**: PocketBase (SQLite database, auth, admin UI)
- **All-in-one**: No external database needed

## First-Time Setup

After installation:

1. **Open PocketBase Admin**: Go to `https://your-app/_/`
2. **Create admin account**: First visitor creates the super admin
3. **Import schema**: Collections are created automatically on first use
4. **Create your Game Haven admin**: Sign up in the app, then assign admin role in PocketBase

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SITE_NAME` | ❌ | Site title (default: "Game Haven") |
| `SITE_DESCRIPTION` | ❌ | Site description |
| `FEATURE_PLAY_LOGS` | ❌ | Enable play logging (default: true) |
| `FEATURE_WISHLIST` | ❌ | Enable wishlists (default: true) |
| `FEATURE_FOR_SALE` | ❌ | Enable for-sale listings (default: true) |
| `FEATURE_MESSAGING` | ❌ | Enable messaging (default: true) |
| `FEATURE_DEMO_MODE` | ❌ | Enable demo mode (default: false) |
| `PB_ENCRYPTION_KEY` | ❌ | Optional encryption key for PocketBase |

## Data Storage

PocketBase stores all data in `/app/data/pb_data/`:
- `data.db` - SQLite database
- `storage/` - Uploaded files

Cloudron automatically backs up `/app/data/`.

## Architecture

```
┌─────────────────────────────────────────┐
│            Cloudron Container           │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────┐     ┌──────────────┐  │
│  │   Nginx     │────▶│  PocketBase  │  │
│  │   (port 80) │     │  (port 8090) │  │
│  └─────┬───────┘     └──────┬───────┘  │
│        │                    │          │
│        ▼                    ▼          │
│  ┌─────────────┐     ┌──────────────┐  │
│  │ React App   │     │   SQLite DB  │  │
│  │ /app/dist   │     │ /app/data/   │  │
│  └─────────────┘     └──────────────┘  │
│                                         │
└─────────────────────────────────────────┘
```

## URLs

| Path | Description |
|------|-------------|
| `/` | Game Haven app |
| `/_/` | PocketBase admin UI |
| `/api/` | PocketBase REST API |
| `/health` | Health check endpoint |

## Backup & Restore

**Export database:**
```bash
cloudron exec -- cat /app/data/pb_data/data.db > backup.db
```

**Restore database:**
```bash
cloudron exec -- bash -c 'cat > /app/data/pb_data/data.db' < backup.db
cloudron restart
```

## Migrating from Supabase

1. Export your Supabase data as JSON/CSV
2. Install Game Haven on Cloudron
3. Access PocketBase admin at `/_/`
4. Import data via PocketBase's import feature

## Files

```
deploy/cloudron/
├── Dockerfile              # Build image with PocketBase
├── CloudronManifest.json   # Cloudron app config
├── nginx.conf              # Routes frontend + API
├── start.sh                # Starts PocketBase + Nginx
└── logo.png                # App icon (add your own)
```
