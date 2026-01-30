#!/bin/sh
# Inject runtime configuration into the frontend
# This runs at container start to inject environment-specific values

set -e

CONFIG_FILE="/usr/share/nginx/html/runtime-config.js"
INDEX_FILE="/usr/share/nginx/html/index.html"

echo "Injecting runtime configuration..."
echo "  SUPABASE_URL: ${SUPABASE_URL:-not set}"
echo "  SITE_NAME: ${SITE_NAME:-GameTaverns}"

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
console.log('[GameTaverns] Runtime config loaded:', window.__RUNTIME_CONFIG__.SELF_HOSTED ? 'Self-Hosted Mode' : 'Cloud Mode');
EOF

# Ensure the file was created
if [ ! -f "$CONFIG_FILE" ]; then
    echo "ERROR: Failed to create $CONFIG_FILE"
    exit 1
fi

# Inject script tag into index.html at the VERY BEGINNING of <head>
# This ensures config is available before any other scripts run
if [ -f "$INDEX_FILE" ]; then
    if ! grep -q "runtime-config.js" "$INDEX_FILE"; then
        # Use a more reliable sed pattern that works on alpine
        sed -i 's|<head>|<head><script src="/runtime-config.js"></script>|' "$INDEX_FILE"
        echo "Injected runtime-config.js script tag into index.html"
    else
        echo "runtime-config.js script tag already present in index.html"
    fi
else
    echo "WARNING: index.html not found at $INDEX_FILE"
fi

echo "Runtime config injection complete"
