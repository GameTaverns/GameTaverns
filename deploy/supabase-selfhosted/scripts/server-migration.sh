#!/bin/bash
# =============================================================================
# GameTaverns Server Migration Script
# Version: 1.0.0
# 
# Migrates an entire GameTaverns self-hosted stack to a new server.
# Handles: database, storage volumes, mail data, config, SSL, cron, DNS checklist.
#
# Usage:
#   ON OLD SERVER (export):
#     sudo ./server-migration.sh export
#
#   TRANSFER (from old server or any machine):
#     sudo ./server-migration.sh transfer <new-server-ip> [ssh-port]
#
#   ON NEW SERVER (import):
#     sudo ./server-migration.sh import <export-bundle-path>
#
#   OPTIONAL - ON OLD SERVER (after verifying new server works):
#     sudo ./server-migration.sh cutover-old
#
# =============================================================================

set -euo pipefail

# =====================
# Configuration
# =====================
INSTALL_DIR="/opt/gametaverns"
COMPOSE_FILE="$INSTALL_DIR/deploy/supabase-selfhosted/docker-compose.yml"
ENV_FILE="$INSTALL_DIR/.env"
EXPORT_DIR="$INSTALL_DIR/migration-export"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BUNDLE_NAME="gametaverns-migration-${TIMESTAMP}"
BUNDLE_DIR="${EXPORT_DIR}/${BUNDLE_NAME}"

# Docker volume names (must match docker-compose.yml project name 'gametaverns')
DB_VOLUME="gametaverns_db-data"
STORAGE_VOLUME="gametaverns_storage-data"
MAIL_VOLUME="gametaverns_mail-data"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# =====================
# Helpers
# =====================
log_info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "\n${CYAN}${BOLD}── $1 ──${NC}"; }

dcp() {
    docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

require_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run as root: sudo $0 $*"
        exit 1
    fi
}

require_env() {
    if [ ! -f "$ENV_FILE" ]; then
        log_error ".env file not found at $ENV_FILE"
        exit 1
    fi
}

print_banner() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║          GameTaverns - Server Migration Tool                      ║"
    echo "║          Mode: $1$(printf '%*s' $((40 - ${#1})) '')║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo ""
}

human_size() {
    local file="$1"
    du -sh "$file" 2>/dev/null | cut -f1 || echo "?"
}

# =====================
# PHASE 1: EXPORT (run on OLD server)
# =====================
do_export() {
    require_root
    require_env
    print_banner "EXPORT (Old Server)"

    # Pre-flight checks
    log_step "Pre-flight checks"
    
    if ! command -v docker &>/dev/null; then
        log_error "Docker not found"
        exit 1
    fi

    if ! dcp ps --status running 2>/dev/null | grep -q "db"; then
        log_error "Database container is not running. Start services first."
        exit 1
    fi

    # Check available disk space (need at least 2x current data)
    local available_kb
    available_kb=$(df -k "$INSTALL_DIR" | tail -1 | awk '{print $4}')
    local available_gb=$((available_kb / 1024 / 1024))
    log_info "Available disk space: ~${available_gb}GB"
    
    if [ "$available_gb" -lt 2 ]; then
        log_warn "Low disk space. Export may fail if database is large."
        read -p "Continue anyway? (yes/no): " CONFIRM
        [ "$CONFIRM" != "yes" ] && exit 0
    fi

    # Create export directory
    mkdir -p "$BUNDLE_DIR"
    log_ok "Export directory: $BUNDLE_DIR"

    # ── 1. Database: Full pg_dumpall ──
    log_step "Exporting database (pg_dumpall - includes auth, all schemas)"
    
    local db_file="$BUNDLE_DIR/database_full.sql.gz"
    if dcp exec -T db pg_dumpall -U supabase_admin --clean 2>/dev/null | gzip > "$db_file"; then
        if [ -s "$db_file" ]; then
            log_ok "Database exported: $(human_size "$db_file")"
        else
            log_error "Database export is empty!"
            rm -f "$db_file"
            exit 1
        fi
    else
        log_error "pg_dumpall failed"
        exit 1
    fi

    # ── 2. Storage volume ──
    log_step "Exporting storage volume ($STORAGE_VOLUME)"
    
    local storage_file="$BUNDLE_DIR/storage_volume.tar.gz"
    if docker volume inspect "$STORAGE_VOLUME" &>/dev/null; then
        docker run --rm \
            -v "${STORAGE_VOLUME}":/data:ro \
            -v "$BUNDLE_DIR":/backup \
            alpine tar -czf /backup/storage_volume.tar.gz -C /data . 2>/dev/null
        log_ok "Storage exported: $(human_size "$storage_file")"
    else
        log_warn "Storage volume not found, skipping"
    fi

    # ── 3. Mail volume ──
    log_step "Exporting mail volume ($MAIL_VOLUME)"
    
    local mail_file="$BUNDLE_DIR/mail_volume.tar.gz"
    if docker volume inspect "$MAIL_VOLUME" &>/dev/null; then
        docker run --rm \
            -v "${MAIL_VOLUME}":/data:ro \
            -v "$BUNDLE_DIR":/backup \
            alpine tar -czf /backup/mail_volume.tar.gz -C /data . 2>/dev/null
        log_ok "Mail exported: $(human_size "$mail_file")"
    else
        log_warn "Mail volume not found, skipping"
    fi

    # ── 4. Configuration files ──
    log_step "Exporting configuration"
    
    # .env (most critical file)
    cp "$ENV_FILE" "$BUNDLE_DIR/dot-env.backup"
    chmod 600 "$BUNDLE_DIR/dot-env.backup"
    log_ok ".env backed up"

    # Kong config
    if [ -f "$INSTALL_DIR/kong.yml" ]; then
        cp "$INSTALL_DIR/kong.yml" "$BUNDLE_DIR/kong.yml"
        log_ok "kong.yml backed up"
    fi

    # ── 5. SSL certificates ──
    log_step "Exporting SSL certificates"
    
    local ssl_dirs=("/etc/letsencrypt" "$INSTALL_DIR/ssl" "$INSTALL_DIR/certs")
    local ssl_exported=false
    for ssl_dir in "${ssl_dirs[@]}"; do
        if [ -d "$ssl_dir" ] && [ "$(ls -A "$ssl_dir" 2>/dev/null)" ]; then
            tar -czf "$BUNDLE_DIR/ssl_$(basename "$ssl_dir").tar.gz" \
                -C "$(dirname "$ssl_dir")" "$(basename "$ssl_dir")" 2>/dev/null || true
            log_ok "SSL from $ssl_dir exported"
            ssl_exported=true
        fi
    done
    if [ "$ssl_exported" = false ]; then
        log_warn "No SSL certificates found (will need to re-generate on new server)"
    fi

    # ── 6. Cron jobs ──
    log_step "Exporting cron jobs"
    
    crontab -l > "$BUNDLE_DIR/crontab_root.txt" 2>/dev/null || true
    if [ -s "$BUNDLE_DIR/crontab_root.txt" ]; then
        log_ok "Root crontab exported"
    else
        log_warn "No root crontab found"
    fi

    # ── 7. Custom Nginx configs ──
    log_step "Exporting Nginx configuration"
    
    if [ -d "$INSTALL_DIR/deploy/supabase-selfhosted/nginx" ]; then
        tar -czf "$BUNDLE_DIR/nginx_configs.tar.gz" \
            -C "$INSTALL_DIR/deploy/supabase-selfhosted" nginx 2>/dev/null || true
        log_ok "Nginx configs exported"
    fi

    # ── 8. Edge function secrets / extra configs ──
    log_step "Exporting supplementary data"
    
    # Existing backups (optional, can be large)
    if [ -d "$INSTALL_DIR/backups" ] && [ "$(ls -A "$INSTALL_DIR/backups" 2>/dev/null)" ]; then
        local backup_size
        backup_size=$(du -sm "$INSTALL_DIR/backups" 2>/dev/null | cut -f1)
        if [ "${backup_size:-0}" -lt 500 ]; then
            tar -czf "$BUNDLE_DIR/old_backups.tar.gz" \
                -C "$INSTALL_DIR" backups 2>/dev/null || true
            log_ok "Old backups exported (${backup_size}MB)"
        else
            log_warn "Backups directory is ${backup_size}MB — skipping (transfer manually if needed)"
        fi
    fi

    # ── 9. Create manifest ──
    log_step "Creating manifest"
    
    cat > "$BUNDLE_DIR/MANIFEST.txt" <<EOF
GameTaverns Server Migration Bundle
====================================
Created:    $(date -u '+%Y-%m-%d %H:%M:%S UTC')
Hostname:   $(hostname)
Server IP:  $(hostname -I 2>/dev/null | awk '{print $1}' || echo 'unknown')
Kernel:     $(uname -r)
Docker:     $(docker --version 2>/dev/null || echo 'unknown')

Files:
$(ls -lh "$BUNDLE_DIR"/ | tail -n +2)

Database container version:
$(dcp exec -T db psql -U supabase_admin -d postgres -c "SELECT version();" 2>/dev/null | head -3 || echo '  unknown')

Important notes:
- The .env file contains secrets. Keep this bundle secure.
- SSL certificates may need re-generation on the new server.
- DNS records must be updated to point to the new server IP.
- After import, run setup-ssl.sh if certificates weren't transferred.
EOF

    log_ok "Manifest created"

    # ── 10. Create single tarball ──
    log_step "Creating final bundle"
    
    local final_tar="${EXPORT_DIR}/${BUNDLE_NAME}.tar.gz"
    tar -czf "$final_tar" -C "$EXPORT_DIR" "$BUNDLE_NAME"
    
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo -e "║  ${GREEN}Export Complete!${NC}                                                 ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "  Bundle: $final_tar"
    echo "  Size:   $(human_size "$final_tar")"
    echo ""
    echo "  Next steps:"
    echo "    1. Transfer to new server:"
    echo "       sudo $0 transfer <new-server-ip>"
    echo "       OR manually: scp $final_tar root@new-server:/opt/"
    echo ""
    echo "    2. On new server, run:"
    echo "       sudo $0 import /opt/${BUNDLE_NAME}.tar.gz"
    echo ""
}

# =====================
# PHASE 2: TRANSFER (run from old server or any machine with SSH access)
# =====================
do_transfer() {
    local target_ip="${1:-}"
    local ssh_port="${2:-22}"
    
    if [ -z "$target_ip" ]; then
        log_error "Usage: $0 transfer <new-server-ip> [ssh-port]"
        exit 1
    fi

    print_banner "TRANSFER → $target_ip"

    # Find the latest export bundle
    local latest_bundle
    latest_bundle=$(ls -t "${EXPORT_DIR}"/gametaverns-migration-*.tar.gz 2>/dev/null | head -1)
    
    if [ -z "$latest_bundle" ]; then
        log_error "No export bundle found in $EXPORT_DIR"
        log_error "Run '$0 export' first"
        exit 1
    fi

    log_info "Bundle: $latest_bundle ($(human_size "$latest_bundle"))"
    log_info "Target: $target_ip:$ssh_port"
    echo ""

    # Ensure target directory exists
    log_step "Preparing target server"
    ssh -p "$ssh_port" "root@${target_ip}" "mkdir -p /opt/gametaverns" 2>/dev/null || {
        log_error "Cannot SSH to root@${target_ip}:${ssh_port}"
        log_error "Ensure SSH access is configured and the target server is reachable"
        exit 1
    }
    log_ok "Target server accessible"

    # Transfer with rsync (resume-capable) or fall back to scp
    log_step "Transferring bundle"
    if command -v rsync &>/dev/null; then
        rsync -avz --progress -e "ssh -p $ssh_port" \
            "$latest_bundle" "root@${target_ip}:/opt/gametaverns/"
    else
        scp -P "$ssh_port" "$latest_bundle" "root@${target_ip}:/opt/gametaverns/"
    fi

    log_ok "Transfer complete!"
    echo ""
    echo "  Next: SSH into the new server and run:"
    echo "    cd /opt/gametaverns"
    echo "    sudo ./deploy/supabase-selfhosted/scripts/server-migration.sh import /opt/gametaverns/$(basename "$latest_bundle")"
    echo ""
}

# =====================
# PHASE 3: IMPORT (run on NEW server)
# =====================
do_import() {
    local bundle_path="${1:-}"
    
    if [ -z "$bundle_path" ]; then
        log_error "Usage: $0 import <path-to-bundle.tar.gz>"
        exit 1
    fi

    if [ ! -f "$bundle_path" ]; then
        log_error "Bundle not found: $bundle_path"
        exit 1
    fi

    require_root
    print_banner "IMPORT (New Server)"

    log_info "Bundle: $bundle_path ($(human_size "$bundle_path"))"
    echo ""
    echo -e "${YELLOW}This will set up GameTaverns on this server.${NC}"
    echo -e "${YELLOW}If services are already running, they will be stopped during import.${NC}"
    echo ""
    read -p "Type 'yes' to continue: " CONFIRM
    [ "$CONFIRM" != "yes" ] && { echo "Cancelled."; exit 0; }

    # ── 1. Extract bundle ──
    log_step "Extracting bundle"
    
    local import_dir="/tmp/gametaverns-import-$$"
    mkdir -p "$import_dir"
    tar -xzf "$bundle_path" -C "$import_dir"
    
    # Find the actual bundle directory (one level deep)
    local bundle_dir
    bundle_dir=$(find "$import_dir" -maxdepth 1 -type d -name "gametaverns-migration-*" | head -1)
    if [ -z "$bundle_dir" ]; then
        bundle_dir="$import_dir"
    fi
    
    log_ok "Extracted to $bundle_dir"
    
    if [ -f "$bundle_dir/MANIFEST.txt" ]; then
        echo ""
        echo -e "${CYAN}Source server info:${NC}"
        head -8 "$bundle_dir/MANIFEST.txt" | tail -5 | sed 's/^/  /'
        echo ""
    fi

    # ── 2. Pre-requisites check ──
    log_step "Checking prerequisites"
    
    if ! command -v docker &>/dev/null; then
        log_error "Docker is not installed. Install Docker first:"
        echo "  curl -fsSL https://get.docker.com | sh"
        exit 1
    fi
    log_ok "Docker installed"

    if ! command -v git &>/dev/null; then
        log_warn "Git not installed — installing..."
        apt-get update -qq && apt-get install -y -qq git >/dev/null 2>&1
    fi
    log_ok "Git installed"

    # ── 3. Clone/update repository ──
    log_step "Setting up repository"
    
    if [ -d "$INSTALL_DIR/.git" ]; then
        log_info "Repository already exists at $INSTALL_DIR"
        cd "$INSTALL_DIR"
        git fetch origin 2>/dev/null || true
        git reset --hard origin/main 2>/dev/null || git reset --hard origin/master 2>/dev/null || true
    elif [ ! -d "$INSTALL_DIR" ]; then
        log_info "Cloning repository..."
        git clone https://github.com/GameTaverns/GameTaverns.git "$INSTALL_DIR" 2>/dev/null || {
            log_warn "Git clone failed — creating directory structure"
            mkdir -p "$INSTALL_DIR/deploy/supabase-selfhosted"
        }
    fi
    log_ok "Repository ready"

    # ── 4. Restore .env ──
    log_step "Restoring configuration"
    
    if [ -f "$bundle_dir/dot-env.backup" ]; then
        cp "$bundle_dir/dot-env.backup" "$ENV_FILE"
        chmod 600 "$ENV_FILE"
        log_ok ".env restored"
        
        # Update SITE_URL if user wants to change domain
        echo ""
        echo -e "  Current SITE_URL: ${CYAN}$(grep '^SITE_URL=' "$ENV_FILE" | cut -d= -f2-)${NC}"
        read -p "  Update SITE_URL? (enter new URL or press Enter to keep): " NEW_URL
        if [ -n "$NEW_URL" ]; then
            sed -i "s|^SITE_URL=.*|SITE_URL=${NEW_URL}|" "$ENV_FILE"
            log_ok "SITE_URL updated to $NEW_URL"
        fi
    else
        log_error "No .env backup found in bundle!"
        exit 1
    fi

    # Restore kong.yml
    if [ -f "$bundle_dir/kong.yml" ]; then
        cp "$bundle_dir/kong.yml" "$INSTALL_DIR/kong.yml"
        log_ok "kong.yml restored"
    fi

    # Source env for compose commands
    set -a
    source "$ENV_FILE"
    set +a

    # ── 5. Start infrastructure (DB only first) ──
    log_step "Starting database service"
    
    # Stop everything if running
    dcp down 2>/dev/null || true
    
    # Start only the database
    dcp up -d db
    
    # Wait for DB to be ready
    log_info "Waiting for database to accept connections..."
    local retries=0
    while ! dcp exec -T db pg_isready -U supabase_admin 2>/dev/null; do
        retries=$((retries + 1))
        if [ "$retries" -gt 30 ]; then
            log_error "Database failed to start after 30 attempts"
            exit 1
        fi
        sleep 2
    done
    log_ok "Database is ready"

    # ── 6. Restore database ──
    log_step "Restoring database (this may take a while for large datasets)"
    
    local db_file="$bundle_dir/database_full.sql.gz"
    if [ -f "$db_file" ]; then
        local db_size
        db_size=$(human_size "$db_file")
        log_info "Database dump size: $db_size"
        
        # Restore using pg_dumpall output (includes DROP/CREATE)
        if gunzip -c "$db_file" | dcp exec -T db psql -U supabase_admin -d postgres \
            --set ON_ERROR_STOP=off 2>&1 | tail -5; then
            log_ok "Database restored"
        else
            log_warn "Database restore had some warnings (this is often normal with pg_dumpall)"
        fi
        
        # Verify
        local table_count
        table_count=$(dcp exec -T db psql -U supabase_admin -d postgres -t -c \
            "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
        log_ok "Public schema has ${table_count:-?} tables"
        
        # Notify PostgREST to reload schema cache
        dcp exec -T db psql -U supabase_admin -d postgres -c "NOTIFY pgrst, 'reload schema';" 2>/dev/null || true
    else
        log_error "No database dump found in bundle!"
        exit 1
    fi

    # ── 7. Restore storage volume ──
    log_step "Restoring storage volume"
    
    if [ -f "$bundle_dir/storage_volume.tar.gz" ]; then
        # Ensure volume exists
        docker volume create "$STORAGE_VOLUME" 2>/dev/null || true
        
        docker run --rm \
            -v "${STORAGE_VOLUME}":/data \
            -v "$bundle_dir":/backup:ro \
            alpine sh -c "rm -rf /data/* && tar -xzf /backup/storage_volume.tar.gz -C /data" 2>/dev/null
        log_ok "Storage volume restored"
    else
        log_warn "No storage volume backup found, skipping"
    fi

    # ── 8. Restore mail volume ──
    log_step "Restoring mail volume"
    
    if [ -f "$bundle_dir/mail_volume.tar.gz" ]; then
        docker volume create "$MAIL_VOLUME" 2>/dev/null || true
        
        docker run --rm \
            -v "${MAIL_VOLUME}":/data \
            -v "$bundle_dir":/backup:ro \
            alpine sh -c "rm -rf /data/* && tar -xzf /backup/mail_volume.tar.gz -C /data" 2>/dev/null
        log_ok "Mail volume restored"
    else
        log_warn "No mail volume backup found, skipping"
    fi

    # ── 9. Restore SSL certificates ──
    log_step "Restoring SSL certificates"
    
    local ssl_restored=false
    if [ -f "$bundle_dir/ssl_letsencrypt.tar.gz" ]; then
        tar -xzf "$bundle_dir/ssl_letsencrypt.tar.gz" -C /etc/ 2>/dev/null || true
        log_ok "Let's Encrypt certificates restored"
        ssl_restored=true
    fi
    if [ -f "$bundle_dir/ssl_ssl.tar.gz" ]; then
        tar -xzf "$bundle_dir/ssl_ssl.tar.gz" -C "$INSTALL_DIR/" 2>/dev/null || true
        log_ok "Custom SSL certificates restored"
        ssl_restored=true
    fi
    if [ "$ssl_restored" = false ]; then
        log_warn "No SSL certificates found — run setup-ssl.sh after DNS is updated"
    fi

    # ── 10. Restore cron jobs ──
    log_step "Restoring cron jobs"
    
    if [ -f "$bundle_dir/crontab_root.txt" ] && [ -s "$bundle_dir/crontab_root.txt" ]; then
        echo ""
        echo "  Exported crontab:"
        sed 's/^/    /' "$bundle_dir/crontab_root.txt"
        echo ""
        read -p "  Install this crontab? (yes/no): " CRON_CONFIRM
        if [ "$CRON_CONFIRM" = "yes" ]; then
            crontab "$bundle_dir/crontab_root.txt"
            log_ok "Crontab installed"
        else
            log_info "Skipped. Saved at: $bundle_dir/crontab_root.txt"
        fi
    else
        log_warn "No crontab to restore"
    fi

    # ── 11. Fix permissions on scripts ──
    log_step "Fixing file permissions"
    
    find "$INSTALL_DIR/deploy" -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true
    log_ok "Script permissions fixed"

    # ── 12. Build and start all services ──
    log_step "Building and starting all services"
    
    dcp build --no-cache app 2>&1 | tail -3
    log_ok "App container built"
    
    dcp up -d
    log_ok "All services started"

    # ── 13. Health checks ──
    log_step "Running health checks"
    
    sleep 5
    
    # Check each critical service
    local services=("db" "rest" "auth" "kong" "app")
    local all_healthy=true
    for svc in "${services[@]}"; do
        if dcp ps --status running 2>/dev/null | grep -q "$svc"; then
            echo -e "  ${GREEN}✓${NC} $svc"
        else
            echo -e "  ${RED}✗${NC} $svc"
            all_healthy=false
        fi
    done

    # Test API endpoint
    echo ""
    local site_url
    site_url=$(grep '^SITE_URL=' "$ENV_FILE" | cut -d= -f2-)
    if curl -sf "http://localhost:8000/rest/v1/" -H "apikey: $(grep '^ANON_KEY=' "$ENV_FILE" | cut -d= -f2-)" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} PostgREST API responding"
    else
        echo -e "  ${YELLOW}⚠${NC} PostgREST API not responding yet (may need a moment)"
    fi

    # Quick data integrity check
    local game_count
    game_count=$(dcp exec -T db psql -U supabase_admin -d postgres -t -c \
        "SELECT count(*) FROM public.games;" 2>/dev/null | tr -d ' ')
    local library_count
    library_count=$(dcp exec -T db psql -U supabase_admin -d postgres -t -c \
        "SELECT count(*) FROM public.libraries;" 2>/dev/null | tr -d ' ')
    local user_count
    user_count=$(dcp exec -T db psql -U supabase_admin -d postgres -t -c \
        "SELECT count(*) FROM auth.users;" 2>/dev/null | tr -d ' ')
    local catalog_count
    catalog_count=$(dcp exec -T db psql -U supabase_admin -d postgres -t -c \
        "SELECT count(*) FROM public.game_catalog;" 2>/dev/null | tr -d ' ')

    echo ""
    echo -e "  ${CYAN}Data verification:${NC}"
    echo "    Users:     ${user_count:-?}"
    echo "    Libraries: ${library_count:-?}"
    echo "    Games:     ${game_count:-?}"
    echo "    Catalog:   ${catalog_count:-?}"

    # ── Cleanup ──
    rm -rf "$import_dir"

    # ── Summary ──
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo -e "║  ${GREEN}Import Complete!${NC}                                                 ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo ""
    
    if [ "$all_healthy" = true ]; then
        echo -e "  ${GREEN}All services are running!${NC}"
    else
        echo -e "  ${YELLOW}Some services may still be starting. Check:${NC}"
        echo "    docker compose -f $COMPOSE_FILE ps"
    fi

    echo ""
    echo "  ┌─────────────────────────────────────────────────────────┐"
    echo "  │  POST-MIGRATION CHECKLIST                              │"
    echo "  ├─────────────────────────────────────────────────────────┤"
    echo "  │  □ Update DNS A record to this server's IP             │"
    echo "  │  □ Wait for DNS propagation (check: dig gametaverns.com)│"
    echo "  │  □ Run setup-ssl.sh if certs weren't transferred       │"
    echo "  │  □ Verify login works                                  │"
    echo "  │  □ Verify images/uploads load correctly                │"
    echo "  │  □ Verify catalog search works                         │"
    echo "  │  □ Test game night polls (share links)                 │"
    echo "  │  □ Verify tenant subdomains resolve                    │"
    echo "  │  □ Stop services on old server (cutover-old)           │"
    echo "  │  □ Update monitoring/alerting endpoints                │"
    echo "  └─────────────────────────────────────────────────────────┘"
    echo ""
    echo "  To stop old server services:"
    echo "    sudo $0 cutover-old   (run on OLD server)"
    echo ""
}

# =====================
# PHASE 4: CUTOVER OLD SERVER (run on old server after verification)
# =====================
do_cutover_old() {
    require_root
    require_env
    print_banner "CUTOVER (Stop Old Server)"

    echo -e "${YELLOW}This will stop all GameTaverns services on THIS server.${NC}"
    echo "Only do this AFTER verifying the new server is working correctly."
    echo ""
    read -p "Have you verified the new server is fully operational? (yes/no): " CONFIRM
    [ "$CONFIRM" != "yes" ] && { echo "Cancelled."; exit 0; }

    echo ""
    read -p "Type the hostname of the NEW server to confirm: " NEW_HOST
    echo ""

    log_step "Stopping services"
    dcp down
    log_ok "All services stopped"

    log_step "Disabling auto-start"
    # Remove cron jobs that might restart services
    if crontab -l 2>/dev/null | grep -q "gametaverns"; then
        crontab -l 2>/dev/null | grep -v "gametaverns" | crontab - 2>/dev/null || true
        log_ok "Cron jobs removed"
    fi

    echo ""
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo -e "║  ${GREEN}Old server decommissioned${NC}                                       ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "  Services are stopped. Data is preserved at $INSTALL_DIR"
    echo "  You can safely remove it later with: rm -rf $INSTALL_DIR"
    echo ""
    echo "  The new server ($NEW_HOST) should now be serving traffic."
    echo ""
}

# =====================
# PHASE 5: VERIFY (run on new server to do a quick sanity check)
# =====================
do_verify() {
    require_root
    require_env
    print_banner "VERIFY"

    set -a
    source "$ENV_FILE"
    set +a

    log_step "Service status"
    dcp ps

    log_step "Database connectivity"
    if dcp exec -T db pg_isready -U supabase_admin 2>/dev/null; then
        log_ok "Database is accepting connections"
    else
        log_error "Database is not responding"
    fi

    log_step "Data counts"
    local queries=(
        "SELECT 'Users' as entity, count(*) as cnt FROM auth.users"
        "SELECT 'Libraries', count(*) FROM public.libraries"
        "SELECT 'Games', count(*) FROM public.games"
        "SELECT 'Catalog', count(*) FROM public.game_catalog"
        "SELECT 'Play Sessions', count(*) FROM public.game_sessions"
        "SELECT 'Forum Threads', count(*) FROM public.forum_threads"
    )
    for q in "${queries[@]}"; do
        dcp exec -T db psql -U supabase_admin -d postgres -t -c "$q" 2>/dev/null | sed 's/^/  /'
    done

    log_step "Storage"
    if docker volume inspect "$STORAGE_VOLUME" &>/dev/null; then
        local storage_size
        storage_size=$(docker run --rm -v "${STORAGE_VOLUME}":/data alpine du -sh /data 2>/dev/null | cut -f1)
        log_ok "Storage volume: ${storage_size:-unknown}"
    else
        log_warn "Storage volume not found"
    fi

    log_step "Disk usage"
    df -h "$INSTALL_DIR" | tail -1 | awk '{printf "  Used: %s / %s (%s free)\n", $3, $2, $4}'

    echo ""
}

# =====================
# Main
# =====================
case "${1:-}" in
    export)
        do_export
        ;;
    transfer)
        do_transfer "${2:-}" "${3:-22}"
        ;;
    import)
        do_import "${2:-}"
        ;;
    cutover-old)
        do_cutover_old
        ;;
    verify)
        do_verify
        ;;
    *)
        echo ""
        echo "GameTaverns Server Migration Tool"
        echo ""
        echo "Usage: sudo $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  export              Export all data from this server"
        echo "  transfer <ip> [port] Transfer export bundle to new server via SSH"
        echo "  import <bundle>     Import data on the new server"
        echo "  verify              Quick health check on current server"
        echo "  cutover-old         Stop services on old server after migration"
        echo ""
        echo "Workflow:"
        echo "  1. OLD SERVER:  sudo $0 export"
        echo "  2. OLD SERVER:  sudo $0 transfer <new-ip>"
        echo "  3. NEW SERVER:  sudo $0 import /opt/gametaverns/gametaverns-migration-*.tar.gz"
        echo "  4. VERIFY:      sudo $0 verify"
        echo "  5. Update DNS A record to new server IP"
        echo "  6. OLD SERVER:  sudo $0 cutover-old"
        echo ""
        exit 1
        ;;
esac
