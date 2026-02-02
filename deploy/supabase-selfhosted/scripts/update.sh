#!/bin/bash
# =============================================================================
# Update Script for GameTaverns Self-Hosted
# Version: 2.3.2 - Schema Parity Audit
# =============================================================================

set -e

INSTALL_DIR="/opt/gametaverns"
BACKUP_BEFORE_UPDATE=true
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "=============================================="
echo "  GameTaverns Update"
echo "=============================================="
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root: sudo ./update.sh${NC}"
    exit 1
fi

# Verify installation directory
if [ ! -f "$INSTALL_DIR/.env" ]; then
    echo -e "${RED}Error: .env file not found at $INSTALL_DIR${NC}"
    exit 1
fi

cd "$INSTALL_DIR"

# Create backup first
if [ "$BACKUP_BEFORE_UPDATE" = true ]; then
    echo "Creating backup before update..."
    if [ -f "$INSTALL_DIR/scripts/backup.sh" ]; then
        bash "$INSTALL_DIR/scripts/backup.sh" || echo -e "${YELLOW}Warning: Backup failed, continuing anyway${NC}"
    fi
fi

# Check for git repo
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}Not a git repository - checking for manual source update...${NC}"
    echo "To update manually, copy new files to $INSTALL_DIR"
    echo ""
    read -p "Continue with container rebuild only? (y/N): " CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
        exit 0
    fi
else
    echo ""
    echo "Pulling latest changes from git..."
    
    # Configure git safe directory (for root execution)
    git config --global --add safe.directory "$INSTALL_DIR" 2>/dev/null || true
    
    # Stash local changes if any
    if ! git diff --quiet 2>/dev/null; then
        echo "Stashing local changes..."
        git stash push -m "Auto-stash before update $(date +%Y%m%d_%H%M%S)"
    fi
    
    git fetch origin
    git pull origin main || git pull origin master
fi

echo ""
echo "Rebuilding frontend container..."
docker compose build --no-cache app

echo ""
echo "Applying database migrations..."
if [ -f "$INSTALL_DIR/scripts/run-migrations.sh" ]; then
    bash "$INSTALL_DIR/scripts/run-migrations.sh" || echo -e "${YELLOW}Migration warnings (often OK)${NC}"
fi

echo ""
echo "Restarting services..."
docker compose up -d

# Wait for services to stabilize
echo ""
echo "Waiting for services to stabilize..."
sleep 10

# Check status
echo ""
echo "=============================================="
echo -e "${GREEN}  Update Complete!${NC}"
echo "=============================================="
echo ""
echo "Service Status:"
docker compose ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || docker compose ps
echo ""
echo "Check logs: docker compose logs -f"
echo ""
