#!/bin/bash
set -e

# Cloudron provides these environment variables:
# - CLOUDRON_POSTGRESQL_URL: Full postgres connection string
# - CLOUDRON_APP_DOMAIN: The app's domain
# - CLOUDRON_APP_ORIGIN: Full URL (https://domain)
# - CLOUDRON_MAIL_*: SMTP configuration

echo "==> Starting Game Haven on Cloudron"

# Create runtime config from Cloudron environment
cat > /app/dist/config.json << EOF
{
  "supabaseUrl": "${SUPABASE_URL:-}",
  "supabaseAnonKey": "${SUPABASE_ANON_KEY:-}",
  "siteName": "${SITE_NAME:-Game Haven}",
  "siteDescription": "${SITE_DESCRIPTION:-Browse and discover our collection of board games}",
  "features": {
    "playLogs": ${FEATURE_PLAY_LOGS:-true},
    "wishlist": ${FEATURE_WISHLIST:-true},
    "forSale": ${FEATURE_FOR_SALE:-true},
    "messaging": ${FEATURE_MESSAGING:-true},
    "comingSoon": ${FEATURE_COMING_SOON:-true},
    "demoMode": ${FEATURE_DEMO_MODE:-false}
  }
}
EOF

# If using Cloudron's PostgreSQL, we need external Supabase
# Output helpful message
if [ -z "$SUPABASE_URL" ]; then
    echo "==> WARNING: SUPABASE_URL not configured"
    echo "==> Game Haven requires a Supabase backend. Options:"
    echo "    1. Use Supabase Cloud (free tier available): https://supabase.com"
    echo "    2. Self-host Supabase separately"
    echo "    Configure via Cloudron's environment variables."
fi

# Start nginx
echo "==> Starting nginx..."
exec nginx -g "daemon off;"
