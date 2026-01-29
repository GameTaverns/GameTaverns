#!/bin/bash
set -e

echo "==> Starting Game Haven"

# Inject runtime config into the built app
# This replaces placeholder values in index.html with actual environment variables
CONFIG_FILE="/app/dist/runtime-config.js"

cat > "$CONFIG_FILE" << EOF
window.__RUNTIME_CONFIG__ = {
  SUPABASE_URL: "${SUPABASE_URL:-}",
  SUPABASE_ANON_KEY: "${SUPABASE_ANON_KEY:-}",
  SITE_NAME: "${SITE_NAME:-Game Haven}",
  SITE_DESCRIPTION: "${SITE_DESCRIPTION:-Browse and discover our collection of board games}",
  SITE_AUTHOR: "${SITE_AUTHOR:-Game Haven}",
  FEATURES: {
    PLAY_LOGS: ${FEATURE_PLAY_LOGS:-true},
    WISHLIST: ${FEATURE_WISHLIST:-true},
    FOR_SALE: ${FEATURE_FOR_SALE:-true},
    MESSAGING: ${FEATURE_MESSAGING:-true},
    COMING_SOON: ${FEATURE_COMING_SOON:-true},
    DEMO_MODE: ${FEATURE_DEMO_MODE:-false},
    ACHIEVEMENTS: ${FEATURE_ACHIEVEMENTS:-true},
    LENDING: ${FEATURE_LENDING:-true}
  }
};
EOF

# Inject the runtime config script into index.html
sed -i 's|</head>|<script src="/runtime-config.js"></script></head>|' /app/dist/index.html

# Validate required config
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "==> WARNING: Supabase not configured!"
    echo "    Set SUPABASE_URL and SUPABASE_ANON_KEY in Cloudron environment variables."
    echo "    Get these from https://supabase.com or your Lovable Cloud project."
fi

echo "==> Config: $SITE_NAME"
echo "==> Starting nginx..."
exec nginx -g "daemon off;"
