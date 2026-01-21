#!/bin/bash
set -e

echo "==> Starting Game Haven with PocketBase"

# PocketBase data directory (Cloudron persists /app/data)
PB_DATA="/app/data/pb_data"
mkdir -p "$PB_DATA"

# Start PocketBase in background
echo "==> Starting PocketBase..."
/usr/local/bin/pocketbase serve \
    --dir="$PB_DATA" \
    --http="127.0.0.1:8090" \
    --encryptionEnv="PB_ENCRYPTION_KEY" &

# Wait for PocketBase to be ready
sleep 2
for i in {1..30}; do
    if curl -s http://127.0.0.1:8090/api/health > /dev/null 2>&1; then
        echo "==> PocketBase is ready"
        break
    fi
    sleep 1
done

# Create runtime config
cat > /app/dist/runtime-config.js << EOF
window.__RUNTIME_CONFIG__ = {
  POCKETBASE_URL: "/api",
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
  }
};
EOF

# Inject runtime config into index.html
sed -i 's|</head>|<script src="/runtime-config.js"></script></head>|' /app/dist/index.html

echo "==> Config: $SITE_NAME"
echo "==> PocketBase Admin: http://your-domain/_/"
echo "==> Starting nginx..."
exec nginx -g "daemon off;"
