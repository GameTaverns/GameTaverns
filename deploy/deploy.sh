#!/bin/bash
#######################################
# Game Haven Deployment Wizard
# 
# A streamlined, interactive deployment script
# with support for multiple backends and platforms.
#######################################

set -e

# ============================================
# Configuration
# ============================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_DIR="$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ============================================
# Utility Functions
# ============================================
print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║                                                           ║"
    echo "║   🎲  GAME HAVEN DEPLOYMENT WIZARD  🎲                    ║"
    echo "║                                                           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_step() {
    echo -e "\n${BLUE}━━━ $1 ━━━${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ $1${NC}"
}

prompt() {
    local prompt_text="$1"
    local default_value="$2"
    local result
    
    if [ -n "$default_value" ]; then
        read -p "$prompt_text [$default_value]: " result
        echo "${result:-$default_value}"
    else
        read -p "$prompt_text: " result
        echo "$result"
    fi
}

prompt_yes_no() {
    local prompt_text="$1"
    local default="${2:-n}"
    local result
    
    if [ "$default" = "y" ]; then
        read -p "$prompt_text [Y/n]: " result
        [[ ! "$result" =~ ^[Nn] ]]
    else
        read -p "$prompt_text [y/N]: " result
        [[ "$result" =~ ^[Yy] ]]
    fi
}

prompt_secret() {
    local prompt_text="$1"
    local result
    read -s -p "$prompt_text: " result
    echo ""
    echo "$result"
}

generate_secret() {
    openssl rand -hex 32
}

generate_jwt_secret() {
    openssl rand -base64 64 | tr -d '\n'
}

# ============================================
# Requirement Checks
# ============================================
check_requirements() {
    print_step "Checking Requirements"
    
    local missing=()
    
    command -v docker &>/dev/null || missing+=("docker")
    (docker compose version &>/dev/null || command -v docker-compose &>/dev/null) || missing+=("docker-compose")
    command -v openssl &>/dev/null || missing+=("openssl")
    
    if [ ${#missing[@]} -ne 0 ]; then
        print_error "Missing: ${missing[*]}"
        echo ""
        echo "Install guide:"
        echo "  Docker: https://docs.docker.com/engine/install/"
        echo "  OpenSSL: sudo apt install openssl"
        exit 1
    fi
    
    print_success "All requirements met"
}

# ============================================
# Backend Selection
# ============================================
select_backend() {
    print_step "Backend Configuration"
    
    echo "Choose your backend setup:"
    echo ""
    echo "  ${BOLD}1)${NC} Self-hosted Supabase (full stack in Docker)"
    echo "     • Complete control, no external dependencies"
    echo "     • Requires more resources (4GB+ RAM recommended)"
    echo ""
    echo "  ${BOLD}2)${NC} External Supabase (Supabase Cloud or existing instance)"
    echo "     • Simpler setup, managed database"
    echo "     • Free tier available at supabase.com"
    echo ""
    
    local choice
    read -p "Select [1/2]: " choice
    
    case "$choice" in
        1) BACKEND_MODE="self-hosted" ;;
        2) BACKEND_MODE="external" ;;
        *) 
            print_warning "Invalid choice, defaulting to self-hosted"
            BACKEND_MODE="self-hosted"
            ;;
    esac
    
    print_success "Backend: $BACKEND_MODE"
}

# ============================================
# Feature Configuration
# ============================================
configure_features() {
    print_step "Feature Configuration"
    
    echo "Select which features to enable:"
    echo "(You can change these later in the admin panel)"
    echo ""
    
    FEATURE_PLAY_LOGS=$(prompt_yes_no "  Play Logging (track game sessions)" "y" && echo "true" || echo "false")
    FEATURE_WISHLIST=$(prompt_yes_no "  Wishlist (guests can bookmark games)" "y" && echo "true" || echo "false")
    FEATURE_FOR_SALE=$(prompt_yes_no "  For Sale (mark games as available)" "y" && echo "true" || echo "false")
    FEATURE_MESSAGING=$(prompt_yes_no "  Messaging (contact form for games)" "y" && echo "true" || echo "false")
    FEATURE_COMING_SOON=$(prompt_yes_no "  Coming Soon (upcoming games section)" "y" && echo "true" || echo "false")
    FEATURE_DEMO_MODE=$(prompt_yes_no "  Demo Mode (public demo access)" "n" && echo "true" || echo "false")
    
    echo ""
    print_success "Features configured"
}

# ============================================
# Site Configuration
# ============================================
configure_site() {
    print_step "Site Configuration"
    
    SITE_NAME=$(prompt "Site name" "Game Haven")
    SITE_DESCRIPTION=$(prompt "Site description" "Browse and discover our collection of board games")
    SITE_AUTHOR=$(prompt "Site author/owner" "$SITE_NAME")
    DOMAIN=$(prompt "Domain (without https://)" "localhost")
    
    # Determine protocol
    if [ "$DOMAIN" = "localhost" ]; then
        SITE_URL="http://localhost"
        API_URL="http://localhost:8000"
    else
        if prompt_yes_no "Use HTTPS?" "y"; then
            SITE_URL="https://$DOMAIN"
            API_URL="https://$DOMAIN/api"
        else
            SITE_URL="http://$DOMAIN"
            API_URL="http://$DOMAIN:8000"
        fi
    fi
    
    print_success "Site: $SITE_URL"
}

# ============================================
# External Supabase Configuration
# ============================================
configure_external_supabase() {
    print_step "Supabase Connection"
    
    echo "Enter your Supabase project details:"
    echo "(Find these in your Supabase dashboard → Settings → API)"
    echo ""
    
    SUPABASE_URL=$(prompt "Supabase URL (e.g., https://xxx.supabase.co)")
    SUPABASE_ANON_KEY=$(prompt "Supabase Anon/Public Key")
    SUPABASE_SERVICE_ROLE_KEY=$(prompt_secret "Supabase Service Role Key (hidden)")
    
    # Validate URL format
    if [[ ! "$SUPABASE_URL" =~ ^https?:// ]]; then
        SUPABASE_URL="https://$SUPABASE_URL"
    fi
    
    print_success "Supabase configured"
}

# ============================================
# Self-hosted Supabase Configuration
# ============================================
configure_selfhosted_supabase() {
    print_step "Generating Secure Credentials"
    
    POSTGRES_PASSWORD=$(generate_secret)
    JWT_SECRET=$(generate_jwt_secret)
    PII_ENCRYPTION_KEY=$(generate_secret)
    
    # Generate Supabase keys
    SUPABASE_URL="http://localhost:8000"
    SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
    SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
    
    print_success "Credentials generated (saved to .env)"
}

# ============================================
# Optional Services
# ============================================
configure_optional_services() {
    print_step "Optional Services"
    
    echo "Configure optional integrations (press Enter to skip):"
    echo ""
    
    # SMTP
    if prompt_yes_no "Configure email (SMTP)?" "n"; then
        SMTP_HOST=$(prompt "  SMTP Host")
        SMTP_PORT=$(prompt "  SMTP Port" "587")
        SMTP_USER=$(prompt "  SMTP Username")
        SMTP_PASS=$(prompt_secret "  SMTP Password (hidden)")
        SMTP_FROM=$(prompt "  From Email Address")
    fi
    
    echo ""
    
    # Turnstile
    TURNSTILE_SECRET_KEY=$(prompt "Cloudflare Turnstile Secret (for anti-spam)")
    
    # API Keys
    echo ""
    echo "Optional API keys for enhanced features:"
    FIRECRAWL_API_KEY=$(prompt "  Firecrawl API Key (for BGG import)")
    
    print_success "Optional services configured"
}

# ============================================
# Generate Environment File
# ============================================
generate_env_file() {
    print_step "Generating Configuration"
    
    local env_file="$DEPLOY_DIR/.env"
    
    cat > "$env_file" << EOF
###################################
# Game Haven Configuration
# Generated: $(date)
# Backend Mode: $BACKEND_MODE
###################################

# ========== Site Branding ==========
VITE_SITE_NAME="${SITE_NAME}"
VITE_SITE_DESCRIPTION="${SITE_DESCRIPTION}"
VITE_SITE_AUTHOR="${SITE_AUTHOR}"

# ========== URLs ==========
SITE_URL=${SITE_URL}
API_EXTERNAL_URL=${API_URL}

# ========== Supabase ==========
VITE_SUPABASE_URL=${SUPABASE_URL}
VITE_SUPABASE_PUBLISHABLE_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
EOF

    # Add self-hosted specific config
    if [ "$BACKEND_MODE" = "self-hosted" ]; then
        cat >> "$env_file" << EOF

# ========== Self-Hosted Database ==========
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=postgres
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${SUPABASE_ANON_KEY}
SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}

# ========== Ports ==========
FRONTEND_PORT=80
KONG_HTTP_PORT=8000
STUDIO_PORT=3000
POSTGRES_PORT=5432
EOF
    fi
    
    # Add common config
    cat >> "$env_file" << EOF

# ========== Security ==========
PII_ENCRYPTION_KEY=${PII_ENCRYPTION_KEY:-$(generate_secret)}

# ========== Features ==========
VITE_FEATURE_PLAY_LOGS=${FEATURE_PLAY_LOGS:-true}
VITE_FEATURE_WISHLIST=${FEATURE_WISHLIST:-true}
VITE_FEATURE_FOR_SALE=${FEATURE_FOR_SALE:-true}
VITE_FEATURE_MESSAGING=${FEATURE_MESSAGING:-true}
VITE_FEATURE_COMING_SOON=${FEATURE_COMING_SOON:-true}
VITE_FEATURE_DEMO_MODE=${FEATURE_DEMO_MODE:-false}

# ========== Email (SMTP) ==========
SMTP_HOST=${SMTP_HOST:-}
SMTP_PORT=${SMTP_PORT:-587}
SMTP_USER=${SMTP_USER:-}
SMTP_PASS=${SMTP_PASS:-}
SMTP_FROM=${SMTP_FROM:-}

# ========== Optional Services ==========
TURNSTILE_SECRET_KEY=${TURNSTILE_SECRET_KEY:-}
FIRECRAWL_API_KEY=${FIRECRAWL_API_KEY:-}
EOF

    chmod 600 "$env_file"
    print_success "Configuration saved to deploy/.env"
}

# ============================================
# Docker Compose Selection
# ============================================
select_compose_file() {
    if [ "$BACKEND_MODE" = "self-hosted" ]; then
        COMPOSE_FILE="docker-compose.yml"
    else
        COMPOSE_FILE="docker-compose.external.yml"
    fi
}

# ============================================
# Start Stack
# ============================================
start_stack() {
    print_step "Starting Game Haven"
    
    cd "$DEPLOY_DIR"
    
    select_compose_file
    
    if docker compose version &>/dev/null; then
        docker compose -f "$COMPOSE_FILE" --env-file .env up -d --build
    else
        docker-compose -f "$COMPOSE_FILE" --env-file .env up -d --build
    fi
    
    cd "$PROJECT_ROOT"
    
    print_success "Stack started!"
}

# ============================================
# Health Check
# ============================================
check_health() {
    print_step "Checking Health"
    
    local max_attempts=30
    local attempt=1
    
    echo "Waiting for services to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -sf http://localhost/health &>/dev/null; then
            print_success "Frontend is healthy!"
            break
        fi
        echo -n "."
        sleep 2
        ((attempt++))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        print_warning "Health check timed out - services may still be starting"
        echo "Check logs with: ./deploy.sh logs"
    fi
}

# ============================================
# Print Summary
# ============================================
print_summary() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           🎉 Game Haven is Ready! 🎉                       ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "  ${BOLD}Access Points:${NC}"
    echo "    • Frontend:  $SITE_URL"
    
    if [ "$BACKEND_MODE" = "self-hosted" ]; then
        echo "    • API:       $SITE_URL:8000"
        echo "    • Studio:    $SITE_URL:3000 (database admin)"
    fi
    
    echo ""
    echo "  ${BOLD}Next Steps:${NC}"
    echo "    1. Open $SITE_URL in your browser"
    echo "    2. Create your admin account (first user to sign up)"
    echo "    3. Grant admin role:"
    echo ""
    
    if [ "$BACKEND_MODE" = "self-hosted" ]; then
        echo "       docker exec -it supabase-db psql -U postgres -c \\"
        echo "         \"INSERT INTO public.user_roles (user_id, role) \\"
        echo "          SELECT id, 'admin' FROM auth.users WHERE email = 'your@email.com';\""
    else
        echo "       Run this SQL in your Supabase dashboard:"
        echo "       INSERT INTO public.user_roles (user_id, role)"
        echo "       SELECT id, 'admin' FROM auth.users WHERE email = 'your@email.com';"
    fi
    
    echo ""
    echo "  ${BOLD}Commands:${NC}"
    echo "    ./deploy.sh start   - Start services"
    echo "    ./deploy.sh stop    - Stop services"
    echo "    ./deploy.sh logs    - View logs"
    echo "    ./deploy.sh health  - Check health status"
    echo ""
}

# ============================================
# Stop Stack
# ============================================
stop_stack() {
    print_step "Stopping Game Haven"
    
    cd "$DEPLOY_DIR"
    
    if docker compose version &>/dev/null; then
        docker compose down 2>/dev/null || docker compose -f docker-compose.yml down 2>/dev/null || true
        docker compose -f docker-compose.external.yml down 2>/dev/null || true
    else
        docker-compose down 2>/dev/null || docker-compose -f docker-compose.yml down 2>/dev/null || true
        docker-compose -f docker-compose.external.yml down 2>/dev/null || true
    fi
    
    cd "$PROJECT_ROOT"
    
    print_success "Stack stopped"
}

# ============================================
# Show Logs
# ============================================
show_logs() {
    cd "$DEPLOY_DIR"
    
    if docker compose version &>/dev/null; then
        docker compose logs -f "$@"
    else
        docker-compose logs -f "$@"
    fi
}

# ============================================
# Health Status
# ============================================
show_health() {
    print_step "Service Health"
    
    echo "Frontend:"
    if curl -sf http://localhost/health 2>/dev/null; then
        print_success "Healthy"
    else
        print_error "Unreachable"
    fi
    
    echo ""
    echo "Docker containers:"
    cd "$DEPLOY_DIR"
    docker compose ps 2>/dev/null || docker-compose ps 2>/dev/null
}

# ============================================
# Interactive Wizard
# ============================================
run_wizard() {
    print_banner
    check_requirements
    select_backend
    configure_site
    configure_features
    
    if [ "$BACKEND_MODE" = "external" ]; then
        configure_external_supabase
    else
        configure_selfhosted_supabase
    fi
    
    configure_optional_services
    generate_env_file
    
    echo ""
    if prompt_yes_no "Start Game Haven now?" "y"; then
        start_stack
        check_health
        print_summary
    else
        echo ""
        print_info "Configuration saved. Run './deploy.sh start' when ready."
    fi
}

# ============================================
# Quick Setup (non-interactive)
# ============================================
quick_setup() {
    print_banner
    check_requirements
    
    if [ ! -f "$DEPLOY_DIR/.env" ]; then
        print_error "No .env file found. Run './deploy.sh setup' for interactive wizard."
        exit 1
    fi
    
    # Determine backend mode from .env
    if grep -q "POSTGRES_PASSWORD" "$DEPLOY_DIR/.env"; then
        BACKEND_MODE="self-hosted"
    else
        BACKEND_MODE="external"
    fi
    
    start_stack
    check_health
    
    source "$DEPLOY_DIR/.env"
    SITE_URL="${SITE_URL:-http://localhost}"
    print_summary
}

# ============================================
# Help
# ============================================
show_help() {
    echo "Game Haven Deployment Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  setup       Interactive setup wizard (first time)"
    echo "  start       Start all services"
    echo "  stop        Stop all services"
    echo "  restart     Restart all services"
    echo "  logs        View container logs (add service name to filter)"
    echo "  health      Check service health status"
    echo "  status      Show container status"
    echo "  configure   Re-run configuration wizard"
    echo "  help        Show this help"
    echo ""
    echo "Examples:"
    echo "  $0 setup           # First-time setup"
    echo "  $0 logs frontend   # View frontend logs"
    echo "  $0 restart         # Restart after config change"
}

# ============================================
# Main
# ============================================
main() {
    case "${1:-}" in
        setup|"")
            if [ -f "$DEPLOY_DIR/.env" ] && [ -z "${2:-}" ]; then
                echo "Existing configuration found."
                if prompt_yes_no "Re-run setup wizard?" "n"; then
                    run_wizard
                else
                    quick_setup
                fi
            else
                run_wizard
            fi
            ;;
        configure)
            run_wizard
            ;;
        start)
            quick_setup
            ;;
        stop)
            stop_stack
            ;;
        restart)
            stop_stack
            quick_setup
            ;;
        logs)
            shift
            show_logs "$@"
            ;;
        health)
            show_health
            ;;
        status)
            cd "$DEPLOY_DIR"
            docker compose ps 2>/dev/null || docker-compose ps 2>/dev/null
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

main "$@"
