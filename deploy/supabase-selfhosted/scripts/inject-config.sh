#!/bin/sh
# Inject runtime configuration into the frontend
# This runs at container start to inject environment-specific values

set -e

CONFIG_FILE="/usr/share/nginx/html/runtime-config.js"
INDEX_FILE="/usr/share/nginx/html/index.html"

# Generate runtime config
cat > "$CONFIG_FILE" << EOF
// Runtime configuration - injected at container start
// DO NOT EDIT - this file is auto-generated
window.__RUNTIME_CONFIG__ = {
  SELF_HOSTED: true,
  SUPABASE_URL: "${SUPABASE_URL:-}",
  SUPABASE_ANON_KEY: "${SUPABASE_ANON_KEY:-}",
  SITE_NAME: "${SITE_NAME:-GameTaverns}",
  SITE_DESCRIPTION: "${SITE_DESCRIPTION:-Browse and discover our collection of board games}",
  FEATURE_DEMO_MODE: false
};
EOF

# Inject script tag into index.html at the VERY BEGINNING of <head>
# This ensures config is available before any other scripts run
if ! grep -q "runtime-config.js" "$INDEX_FILE"; then
    sed -i 's|<head>|<head>\n    <script src="/runtime-config.js"></script>|' "$INDEX_FILE"
fi

echo "Runtime config injected successfully"
echo "  SUPABASE_URL: ${SUPABASE_URL:-not set}"
echo "  SITE_NAME: ${SITE_NAME:-GameTaverns}"
