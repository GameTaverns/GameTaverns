#!/bin/bash
# =============================================================================
# Update Script for GameTaverns Self-Hosted
# =============================================================================

set -e

INSTALL_DIR="/opt/gametaverns"
REPO_URL="https://github.com/GameTaverns/GameTaverns.git"

echo ""
echo "=============================================="
echo "  GameTaverns Update"
echo "=============================================="
echo ""

# Create backup first
echo "Creating backup before update..."
if [ -f "$INSTALL_DIR/scripts/backup.sh" ]; then
    bash "$INSTALL_DIR/scripts/backup.sh"
fi

cd "$INSTALL_DIR"

# Check for git repo
if [ ! -d ".git" ]; then
    echo "Error: Not a git repository. Manual update required."
    exit 1
fi

echo ""
echo "Pulling latest changes..."
git fetch origin
git pull origin main

echo ""
echo "Rebuilding containers..."
docker compose build --no-cache app

echo ""
echo "Applying database migrations..."
if [ -f "$INSTALL_DIR/scripts/run-migrations.sh" ]; then
    bash "$INSTALL_DIR/scripts/run-migrations.sh"
fi

echo ""
echo "Restarting services..."
docker compose up -d

echo ""
echo "=============================================="
echo "  Update Complete!"
echo "=============================================="
echo ""
echo "Check service status: docker compose ps"
echo "View logs: docker compose logs -f"
echo ""
