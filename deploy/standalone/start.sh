#!/bin/bash
#
# Runtime configuration injection for Game Haven
# This script runs at container startup to inject environment variables
#

set -e

echo "==> Configuring Game Haven runtime..."

CONFIG_FILE="/usr/share/nginx/html/runtime-config.js"
INDEX_FILE="/usr/share/nginx/html/index.html"

# Create runtime config with environment variables
cat > "$CONFIG_FILE" << EOF
// Game Haven Runtime Configuration
// Generated at container startup - do not edit manually
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
    DEMO_MODE: ${FEATURE_DEMO_MODE:-false}
  },
  // Neutral default theme for standalone (white/grey instead of parchment)
  THEME: {
    LIGHT: {
      background: "0 0% 100%",
      foreground: "222 47% 11%",
      card: "0 0% 100%",
      cardForeground: "222 47% 11%",
      primary: "222 47% 25%",
      primaryForeground: "0 0% 100%",
      secondary: "210 40% 96%",
      secondaryForeground: "222 47% 11%",
      muted: "210 40% 96%",
      mutedForeground: "215 16% 47%",
      accent: "210 40% 96%",
      accentForeground: "222 47% 11%",
      border: "214 32% 91%",
      sidebarBackground: "0 0% 98%",
      sidebarForeground: "222 47% 11%",
      sidebarBorder: "214 32% 91%"
    },
    DARK: {
      background: "222 47% 11%",
      foreground: "210 40% 98%",
      card: "222 47% 13%",
      cardForeground: "210 40% 98%",
      primary: "210 40% 98%",
      primaryForeground: "222 47% 11%",
      secondary: "217 33% 17%",
      secondaryForeground: "210 40% 98%",
      muted: "217 33% 17%",
      mutedForeground: "215 20% 65%",
      accent: "217 33% 17%",
      accentForeground: "210 40% 98%",
      border: "217 33% 17%",
      sidebarBackground: "222 47% 9%",
      sidebarForeground: "210 40% 98%",
      sidebarBorder: "217 33% 17%"
    }
  }
};
console.log('[Game Haven] Runtime config loaded:', window.__RUNTIME_CONFIG__.SITE_NAME);
EOF

# Inject runtime config script into index.html if not already present
if ! grep -q "runtime-config.js" "$INDEX_FILE"; then
    sed -i 's|</head>|<script src="/runtime-config.js"></script></head>|' "$INDEX_FILE"
    echo "==> Injected runtime-config.js into index.html"
fi

# Validate configuration
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "==> ⚠ WARNING: Supabase not configured!"
    echo "    App will run in limited mode without database connectivity."
    echo "    Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables."
else
    echo "==> ✓ Supabase configured: $SUPABASE_URL"
fi

echo "==> ✓ Site: ${SITE_NAME:-Game Haven}"
echo "==> ✓ Features:"
[ "${FEATURE_PLAY_LOGS:-true}" = "true" ] && echo "      - Play Logs"
[ "${FEATURE_WISHLIST:-true}" = "true" ] && echo "      - Wishlist"
[ "${FEATURE_FOR_SALE:-true}" = "true" ] && echo "      - For Sale"
[ "${FEATURE_MESSAGING:-true}" = "true" ] && echo "      - Messaging"
[ "${FEATURE_COMING_SOON:-true}" = "true" ] && echo "      - Coming Soon"
[ "${FEATURE_DEMO_MODE:-false}" = "true" ] && echo "      - Demo Mode"

echo "==> Configuration complete!"
