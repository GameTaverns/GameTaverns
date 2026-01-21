# Game Haven for Cloudron

One-click deployment of Game Haven to your Cloudron server.

## Requirements

- Cloudron 7.0.0 or higher
- External Supabase instance (Cloud or self-hosted)

## Quick Install

### Option 1: From Cloudron App Store
*(Coming soon)*

### Option 2: Manual Build

```bash
# Clone the repository
git clone https://github.com/your-org/game-haven.git
cd game-haven/deploy/cloudron

# Build the Cloudron package
cloudron build

# Install to your Cloudron
cloudron install
```

## Configuration

After installation, configure these environment variables in your Cloudron dashboard:

### Required Variables

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Your Supabase project URL (e.g., `https://xxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | Supabase anonymous/public key |

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
| `FEATURE_DEMO_MODE` | false | Enable public demo |

## Setting Up Supabase

Game Haven requires a Supabase backend. Options:

### Option A: Supabase Cloud (Recommended)
1. Create a free account at [supabase.com](https://supabase.com)
2. Create a new project
3. Run the database migrations (see below)
4. Copy your project URL and anon key to Cloudron env vars

### Option B: Self-Hosted Supabase
If you're running Supabase separately, configure the URL and keys accordingly.

## Database Setup

After connecting Supabase, run the migrations:

1. Go to Supabase Dashboard → SQL Editor
2. Run each migration file from `supabase/migrations/` in order
3. Or use Supabase CLI: `supabase db push`

## Creating Your Admin Account

1. Sign up through the Game Haven web interface
2. In Supabase SQL Editor, run:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   SELECT id, 'admin' FROM auth.users WHERE email = 'your@email.com';
   ```

## Health Check

Game Haven includes a health endpoint at `/health` that Cloudron uses for monitoring.

## Backups

Cloudron handles backups automatically. Your game data is stored in your external Supabase instance.

## Updating

Updates can be applied through the Cloudron dashboard when new versions are available.

## Troubleshooting

### App won't start
- Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are configured
- View logs in Cloudron dashboard

### Can't connect to database
- Verify your Supabase project is accessible
- Check that migrations have been applied
- Ensure RLS policies are properly configured

### Missing features
- Verify feature flag environment variables are set to `true`

## Support

- [GitHub Issues](https://github.com/your-org/game-haven/issues)
- [Cloudron Forum](https://forum.cloudron.io)
