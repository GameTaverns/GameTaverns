#!/bin/bash
# Build script for Android APK (Bundled Mode)
# The app UI is packaged inside the APK; all data comes from gametaverns.com
#
# Usage: ./scripts/build-android.sh
# Then open Android Studio and build the APK/AAB from there.

set -e

echo "================================================"
echo "  Building GameTaverns Android (Bundled Mode)"
echo "  Backend: https://gametaverns.com"
echo "================================================"
echo ""

# Load Android-specific env vars
if [ -f ".env.android" ]; then
  export $(grep -v '^#' .env.android | xargs)
  echo "✓ Loaded .env.android"
else
  echo "ERROR: .env.android not found"
  exit 1
fi

echo "  SUPABASE_URL: $VITE_SUPABASE_URL"
echo ""

# Build the React app with Android credentials
echo "Building React app..."
npx vite build

echo ""
echo "Syncing to Android..."
npx cap sync android

echo ""
echo "================================================"
echo "  Build complete!"
echo "  Next: open Android Studio and build the APK:"
echo "    npx cap open android"
echo "================================================"
