# Game Haven for Cloudron

One-click deployment of Game Haven to your Cloudron server.

## Requirements

- Cloudron 7.0.0 or higher
- External Supabase instance (Cloud or self-hosted)

## Installation Methods

### Option 1: Install via Cloudron Web Interface (Recommended)

1. **Build the Docker Image**
   
   On your local machine or CI server:
   ```bash
   # Clone the repository
   git clone https://github.com/ThaneWinters/GameTavern.git
   cd GameTavern
   
   # Build and push to a container registry
   docker build -f deploy/cloudron/Dockerfile -t your-registry/gamehaven:latest .
   docker push your-registry/gamehaven:latest
   ```

2. **Install via Cloudron Dashboard**
   
   - Log into your Cloudron admin panel (https://my.your-cloudron.domain)
   - Navigate to **App Store** → **Install App**
   - Click **Install from Docker Registry** (or "Custom App")
   - Enter your image: `your-registry/gamehaven:latest`
   - Upload the `CloudronManifest.json` from this directory
   - Choose a subdomain (e.g., `games.your-cloudron.domain`)
   - Click **Install**

3. **Configure Environment Variables**
   
   After installation:
   - Go to the app in your Cloudron dashboard
   - Click **Configure** → **Environment Variables**
   - Add the required variables (see [Configuration](#configuration) below)
   - Click **Save** and the app will restart

### Option 2: Install via Cloudron CLI

```bash
# Clone the repository
git clone https://github.com/ThaneWinters/GameTavern.git
cd GameTavern/deploy/cloudron

# Build the Cloudron package
cloudron build

# Install to your Cloudron (replace with your domain)
cloudron install --location games.your-cloudron.domain
```

### Option 3: Install from Private Registry

If you're using a private Docker registry:

1. Add your registry credentials in Cloudron:
   - Go to **Settings** → **Docker Registry**
   - Add your registry URL and credentials

2. Install the app:
   ```bash
   cloudron install \
     --image your-private-registry/gamehaven:latest \
     --location games.your-cloudron.domain
   ```

## Configuration

Configure these environment variables in your Cloudron dashboard under **Configure** → **Environment Variables**:

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public key | `eyJhbGc...` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SITE_NAME` | Game Haven | Your collection name |
| `SITE_DESCRIPTION` | Browse and discover... | Site description |
| `FEATURE_PLAY_LOGS` | true | Enable play session tracking |
| `FEATURE_WISHLIST` | true | Enable guest wishlists |
| `FEATURE_FOR_SALE` | true | Enable for-sale listings |
| `FEATURE_MESSAGING` | true | Enable contact forms |
| `FEATURE_COMING_SOON` | true | Enable coming soon section |
| `FEATURE_DEMO_MODE` | false | Enable public demo mode |

## Setting Up Supabase

Game Haven requires a Supabase backend. Choose one of these options:

### Option A: Supabase Cloud (Recommended for most users)

1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **Settings** → **API** to find your:
   - Project URL (e.g., `https://abcdefg.supabase.co`)
   - Anon/Public key (starts with `eyJ...`)
4. Run the database migrations (see [Database Setup](#database-setup))
5. Add the URL and key to your Cloudron environment variables

### Option B: Self-Hosted Supabase

If you're running Supabase on the same Cloudron or another server:

1. Use your Supabase instance URL and anon key
2. Ensure your Supabase instance is accessible from the Cloudron server
3. Configure CORS if needed to allow requests from your Game Haven domain

## Database Setup

After connecting to Supabase, set up the database:

### Via Supabase Dashboard

1. Go to Supabase Dashboard → **SQL Editor**
2. Run each migration file from `supabase/migrations/` in chronological order
3. Files are named with timestamps (e.g., `20240101000000_initial.sql`)

### Via Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-id

# Push migrations
supabase db push
```

## Creating Your Admin Account

1. Open your Game Haven instance and sign up with your email
2. In Supabase SQL Editor, run:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   SELECT id, 'admin' FROM auth.users WHERE email = 'your@email.com';
   ```
3. Log out and log back in to activate admin privileges

## Verifying Installation

### Health Check

Game Haven includes a health endpoint that Cloudron monitors:

```bash
curl https://games.your-cloudron.domain/health
```

Expected response:
```json
{"status":"healthy","timestamp":"2024-01-15T10:30:00+00:00"}
```

### In Cloudron Dashboard

- Check the app status shows **Running** (green)
- View logs via **Logs** button for any startup issues

## Updating

### Via Cloudron Dashboard

1. Build and push a new Docker image with the updated code
2. Go to your app in Cloudron dashboard
3. Click **Update** → **Update to latest image**

### Via CLI

```bash
cd game-haven/deploy/cloudron
cloudron build
cloudron update
```

## Backups

Cloudron handles backups automatically. Your data is stored in:

- **Supabase**: All game data, user data, and files (external)
- **Cloudron local storage**: Minimal app cache only

To backup your Supabase data:
- Use Supabase dashboard → **Database** → **Backups**
- Or use `pg_dump` for manual backups

## Troubleshooting

### App won't start

1. Check environment variables are set:
   - `SUPABASE_URL` and `SUPABASE_ANON_KEY` are required
2. View logs in Cloudron dashboard → **Logs**
3. Verify the health endpoint responds

### Can't connect to database

1. Verify your Supabase project is running and accessible
2. Check the URL doesn't have a trailing slash
3. Ensure migrations have been applied
4. Test the connection:
   ```bash
   curl "YOUR_SUPABASE_URL/rest/v1/" \
     -H "apikey: YOUR_ANON_KEY"
   ```

### Authentication issues

1. Verify RLS policies are correctly configured in Supabase
2. Check that auto-confirm is enabled for email signups if desired
3. Ensure your domain is added to allowed redirect URLs in Supabase

### Missing features

1. Check feature flag environment variables are set to `true`
2. Restart the app after changing environment variables

### CORS errors

Add your Cloudron domain to Supabase allowed origins:
1. Supabase Dashboard → **Authentication** → **URL Configuration**
2. Add `https://games.your-cloudron.domain` to **Redirect URLs**

## Uninstalling

```bash
cloudron uninstall --app games.your-cloudron.domain
```

Or via Cloudron Dashboard → App → **Uninstall**

## Support

- [GitHub Issues](https://github.com/ThaneWinters/GameTavern/issues)
- [Cloudron Forum](https://forum.cloudron.io)
- [Supabase Discord](https://discord.supabase.com)
