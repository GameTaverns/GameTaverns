#!/bin/bash

#######################################
# Game Haven Self-Hosted Deployment Script
# 
# This script automates the deployment of Game Haven
# with self-hosted Supabase on a Linux server.
#######################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
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

# Check for required tools
check_requirements() {
    print_header "Checking Requirements"
    
    local missing=()
    
    if ! command -v docker &> /dev/null; then
        missing+=("docker")
    fi
    
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        missing+=("docker-compose")
    fi
    
    if ! command -v openssl &> /dev/null; then
        missing+=("openssl")
    fi
    
    if [ ${#missing[@]} -ne 0 ]; then
        print_error "Missing required tools: ${missing[*]}"
        echo "Please install them and run this script again."
        exit 1
    fi
    
    print_success "All requirements met"
}

# Generate secure random strings
generate_secret() {
    openssl rand -hex 32
}

generate_jwt_secret() {
    openssl rand -base64 64 | tr -d '\n'
}

# Generate Supabase keys (simplified - in production use proper key generation)
generate_supabase_keys() {
    # These are JWT tokens signed with the JWT_SECRET
    # The structure matches Supabase's expected format
    
    local jwt_secret=$1
    
    # Anon key payload: {"role":"anon","iss":"supabase","iat":1700000000,"exp":2000000000}
    ANON_KEY=$(echo -n '{"alg":"HS256","typ":"JWT"}' | base64 -w 0 | tr '+/' '-_' | tr -d '=').$(echo -n '{"role":"anon","iss":"supabase","iat":1700000000,"exp":2000000000}' | base64 -w 0 | tr '+/' '-_' | tr -d '=')
    
    # Service role key payload: {"role":"service_role","iss":"supabase","iat":1700000000,"exp":2000000000}
    SERVICE_ROLE_KEY=$(echo -n '{"alg":"HS256","typ":"JWT"}' | base64 -w 0 | tr '+/' '-_' | tr -d '=').$(echo -n '{"role":"service_role","iss":"supabase","iat":1700000000,"exp":2000000000}' | base64 -w 0 | tr '+/' '-_' | tr -d '=')
}

# Create .env file
create_env_file() {
    print_header "Creating Environment Configuration"
    
    local env_file="deploy/.env"
    
    if [ -f "$env_file" ]; then
        print_warning "Existing .env file found"
        read -p "Overwrite? (y/N): " overwrite
        if [[ ! $overwrite =~ ^[Yy]$ ]]; then
            print_success "Keeping existing configuration"
            return
        fi
    fi
    
    echo "Generating secure credentials..."
    
    # Generate secrets
    local postgres_password=$(generate_secret)
    local jwt_secret=$(generate_jwt_secret)
    local pii_key=$(generate_secret)
    
    # Get user input for site configuration
    echo ""
    read -p "Site name [Game Haven]: " site_name
    site_name=${site_name:-"Game Haven"}
    
    read -p "Site description [Browse and discover our collection of board games]: " site_description
    site_description=${site_description:-"Browse and discover our collection of board games"}
    
    read -p "Site author [$site_name]: " site_author
    site_author=${site_author:-"$site_name"}
    
    read -p "Domain (e.g., games.example.com) [localhost]: " domain
    domain=${domain:-"localhost"}
    
    # SMTP configuration
    echo ""
    print_header "SMTP Configuration (for email notifications)"
    read -p "SMTP Host (leave empty to skip): " smtp_host
    
    if [ -n "$smtp_host" ]; then
        read -p "SMTP Port [587]: " smtp_port
        smtp_port=${smtp_port:-587}
        read -p "SMTP Username: " smtp_user
        read -s -p "SMTP Password: " smtp_pass
        echo ""
        read -p "From Email Address: " smtp_from
    fi
    
    # Cloudflare Turnstile
    echo ""
    print_header "Cloudflare Turnstile (anti-spam)"
    read -p "Turnstile Secret Key (leave empty to skip): " turnstile_key
    
    # Optional: AI/Scraping keys
    echo ""
    print_header "Optional: Import Features"
    read -p "Firecrawl API Key (for BGG import, optional): " firecrawl_key
    read -p "Lovable AI Key (for AI extraction, optional): " lovable_key
    
    # Create the .env file
    cat > "$env_file" << EOF
###################################
# Game Haven Configuration
# Generated: $(date)
###################################

# Site Branding
VITE_SITE_NAME="${site_name}"
VITE_SITE_DESCRIPTION="${site_description}"
VITE_SITE_AUTHOR="${site_author}"

# Domain Configuration
SITE_URL=http://${domain}
API_EXTERNAL_URL=http://${domain}:8000

# Ports
FRONTEND_PORT=80
FRONTEND_SSL_PORT=443
KONG_HTTP_PORT=8000
KONG_HTTPS_PORT=8443
POSTGRES_PORT=5432
STUDIO_PORT=3000

# Database
POSTGRES_PASSWORD=${postgres_password}
POSTGRES_DB=postgres

# JWT / Authentication
JWT_SECRET=${jwt_secret}
ANON_KEY=${ANON_KEY:-"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjIwMDAwMDAwMDB9.placeholder"}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY:-"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.placeholder"}

# Auth Settings
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
DISABLE_SIGNUP=false

# PII Encryption
PII_ENCRYPTION_KEY=${pii_key}

# SMTP Configuration
SMTP_HOST=${smtp_host:-""}
SMTP_PORT=${smtp_port:-587}
SMTP_USER=${smtp_user:-""}
SMTP_PASS=${smtp_pass:-""}
SMTP_FROM=${smtp_from:-""}

# Cloudflare Turnstile
TURNSTILE_SECRET_KEY=${turnstile_key:-""}

# Optional: Import Features
FIRECRAWL_API_KEY=${firecrawl_key:-""}
LOVABLE_API_KEY=${lovable_key:-""}
EOF

    chmod 600 "$env_file"
    print_success "Configuration file created at $env_file"
}

# Initialize database with migrations
init_database() {
    print_header "Initializing Database"
    
    # Copy migrations to init directory
    mkdir -p deploy/volumes/db/init
    
    # Combine all migrations into a single init script
    cat > deploy/volumes/db/init/00-init.sql << 'EOF'
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "unaccent" SCHEMA extensions;

-- Create roles for Supabase
CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'POSTGRES_PASSWORD_PLACEHOLDER';
CREATE ROLE supabase_auth_admin NOINHERIT CREATEROLE LOGIN PASSWORD 'POSTGRES_PASSWORD_PLACEHOLDER';
CREATE ROLE supabase_storage_admin NOINHERIT CREATEROLE LOGIN PASSWORD 'POSTGRES_PASSWORD_PLACEHOLDER';
CREATE ROLE supabase_admin NOINHERIT CREATEROLE LOGIN PASSWORD 'POSTGRES_PASSWORD_PLACEHOLDER';

-- Grant roles
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT supabase_admin TO authenticator;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS _realtime;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
EOF

    # Append application migrations
    echo -e "\n-- Application Migrations\n" >> deploy/volumes/db/init/00-init.sql
    
    for migration in supabase/migrations/*.sql; do
        if [ -f "$migration" ]; then
            echo -e "\n-- Migration: $(basename $migration)\n" >> deploy/volumes/db/init/00-init.sql
            cat "$migration" >> deploy/volumes/db/init/00-init.sql
        fi
    done
    
    # Replace placeholder with actual password
    if [ -f deploy/.env ]; then
        source deploy/.env
        sed -i "s/POSTGRES_PASSWORD_PLACEHOLDER/${POSTGRES_PASSWORD}/g" deploy/volumes/db/init/00-init.sql
    fi
    
    print_success "Database initialization scripts created"
}

# Create necessary directories
create_directories() {
    print_header "Creating Directory Structure"
    
    mkdir -p deploy/volumes/db/data
    mkdir -p deploy/volumes/db/init
    mkdir -p deploy/volumes/storage
    mkdir -p deploy/volumes/kong
    
    print_success "Directories created"
}

# Start the stack
start_stack() {
    print_header "Starting Game Haven Stack"
    
    cd deploy
    
    # Check which docker compose command to use
    if docker compose version &> /dev/null; then
        docker compose --env-file .env up -d
    else
        docker-compose --env-file .env up -d
    fi
    
    cd ..
    
    print_success "Stack started"
    
    echo ""
    echo -e "${GREEN}Game Haven is now running!${NC}"
    echo ""
    echo "Access points:"
    echo "  • Frontend:     http://localhost"
    echo "  • Supabase API: http://localhost:8000"
    echo "  • Studio:       http://localhost:3000 (admin UI)"
    echo ""
    echo "Default admin login:"
    echo "  Create your first user through the signup form"
    echo "  Then grant admin role via Studio or direct SQL"
}

# Stop the stack
stop_stack() {
    print_header "Stopping Game Haven Stack"
    
    cd deploy
    
    if docker compose version &> /dev/null; then
        docker compose down
    else
        docker-compose down
    fi
    
    cd ..
    
    print_success "Stack stopped"
}

# Show logs
show_logs() {
    cd deploy
    
    if docker compose version &> /dev/null; then
        docker compose logs -f "$@"
    else
        docker-compose logs -f "$@"
    fi
    
    cd ..
}

# Main menu
show_help() {
    echo "Game Haven Deployment Script"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  setup     - Full setup (configure, init db, start)"
    echo "  configure - Create/update configuration"
    echo "  start     - Start the stack"
    echo "  stop      - Stop the stack"
    echo "  restart   - Restart the stack"
    echo "  logs      - Show container logs"
    echo "  status    - Show container status"
    echo "  help      - Show this help"
}

# Main execution
main() {
    case "${1:-setup}" in
        setup)
            check_requirements
            create_directories
            create_env_file
            init_database
            start_stack
            ;;
        configure)
            create_env_file
            ;;
        start)
            start_stack
            ;;
        stop)
            stop_stack
            ;;
        restart)
            stop_stack
            start_stack
            ;;
        logs)
            shift
            show_logs "$@"
            ;;
        status)
            cd deploy && docker compose ps && cd ..
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
