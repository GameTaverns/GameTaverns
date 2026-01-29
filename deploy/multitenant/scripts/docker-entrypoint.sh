#!/bin/bash
# Runtime configuration for the frontend container
# Injects environment variables into the built JavaScript

set -e

# Path to the built index.html
INDEX_FILE="/usr/share/nginx/html/index.html"

# Inject runtime config if needed
if [ ! -z "$RUNTIME_CONFIG" ]; then
    echo "Injecting runtime configuration..."
    # Create a config script that will be loaded by the app
    cat > /usr/share/nginx/html/runtime-config.js << EOF
window.__RUNTIME_CONFIG__ = {
    API_URL: "${API_URL:-/api}",
    SITE_NAME: "${SITE_NAME:-GameTaverns}",
    STANDALONE: true
};
EOF
fi

echo "Frontend container starting..."
