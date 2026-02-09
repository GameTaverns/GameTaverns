#!/bin/bash
# =============================================================================
# Update Script for GameTaverns Self-Hosted
# Version: 2.7.4 - Single .env Edition
# Audited: 2026-02-03
# =============================================================================

set -e

# ===========================================
# Configuration - SINGLE .ENV ARCHITECTURE
# ===========================================
INSTALL_DIR="/opt/gametaverns"
COMPOSE_FILE="$INSTALL_DIR/deploy/supabase-selfhosted/docker-compose.yml"
ENV_FILE="$INSTALL_DIR/.env"
BACKUP_BEFORE_UPDATE=true

# Helper function: Run docker compose with explicit paths
dcp() {
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

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
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}Error: .env file not found at $ENV_FILE${NC}"
    exit 1
fi

cd "$INSTALL_DIR"

# Create backup first
if [ "$BACKUP_BEFORE_UPDATE" = true ]; then
    echo "Creating backup before update..."
    if [ -f "$INSTALL_DIR/deploy/supabase-selfhosted/scripts/backup.sh" ]; then
        bash "$INSTALL_DIR/deploy/supabase-selfhosted/scripts/backup.sh" || echo -e "${YELLOW}Warning: Backup failed, continuing anyway${NC}"
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
    
    # Discard ALL local changes to prevent merge conflicts
    echo "Resetting local changes..."
    git reset --hard HEAD
    git fetch --all
    
    # Force sync to remote (main or master)
    BRANCH=$(git remote show origin | grep 'HEAD branch' | awk '{print $NF}')
    BRANCH=${BRANCH:-main}
    echo "Syncing to origin/$BRANCH..."
    git reset --hard origin/$BRANCH
fi

echo ""
echo "Rebuilding frontend..."
dcp build --no-cache app

echo ""
echo "Applying database migrations..."
if [ -f "$INSTALL_DIR/deploy/supabase-selfhosted/scripts/run-migrations.sh" ]; then
    bash "$INSTALL_DIR/deploy/supabase-selfhosted/scripts/run-migrations.sh" || echo -e "${YELLOW}Migration warnings (often OK)${NC}"
fi

echo ""
echo "Fixing bgg_play_id index to be per-game scoped..."
dcp exec -T db psql -U supabase_admin -d postgres -c "
  DROP INDEX IF EXISTS idx_game_sessions_bgg_play_id;
  CREATE UNIQUE INDEX IF NOT EXISTS idx_game_sessions_bgg_play_id 
    ON public.game_sessions(bgg_play_id, game_id) 
    WHERE bgg_play_id IS NOT NULL;
" 2>/dev/null && echo -e "${GREEN}Index updated${NC}" || echo -e "${YELLOW}Index fix skipped (columns may not exist yet)${NC}"

echo ""
echo "Restarting services..."
dcp up -d

echo ""
echo "Force-recreating Edge Functions container (clears Deno cache)..."
dcp up -d --force-recreate functions

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
dcp ps --format "table {{.Name}}\t{{.Status}}" 2>/dev/null || dcp ps
echo ""
echo "Check logs: source $INSTALL_DIR/deploy/supabase-selfhosted/scripts/compose.sh && gt_logs"
echo ""
