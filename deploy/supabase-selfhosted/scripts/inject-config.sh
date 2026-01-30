#!/bin/sh
# Inject runtime configuration into the frontend

CONFIG_FILE="/usr/share/nginx/html/runtime-config.js"
INDEX_FILE="/usr/share/nginx/html/index.html"

# Generate runtime config
cat > "$CONFIG_FILE" << EOF
// Runtime configuration - injected at container start
window.__RUNTIME_CONFIG__ = {
  SELF_HOSTED: true,
  SUPABASE_URL: "${SUPABASE_URL:-}",
  SUPABASE_ANON_KEY: "${SUPABASE_ANON_KEY:-}",
  SITE_NAME: "${SITE_NAME:-GameTaverns}",
  SITE_DESCRIPTION: "${SITE_DESCRIPTION:-Browse and discover our collection of board games}",
  FEATURE_DEMO_MODE: false
};
EOF

# Inject script tag into index.html if not already present
if ! grep -q "runtime-config.js" "$INDEX_FILE"; then
    sed -i 's|<head>|<head>\n    <script src="/runtime-config.js"></script>|' "$INDEX_FILE"
fi

echo "Runtime config injected"
