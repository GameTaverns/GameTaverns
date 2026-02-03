#!/bin/bash
# =============================================================================
# GameTaverns Docker Compose Wrapper
# Ensures all docker compose commands use the single canonical .env file
# Version: 1.0.0
# =============================================================================
#
# USAGE:
#   source /opt/gametaverns/deploy/supabase-selfhosted/scripts/compose.sh
#   gt_compose up -d
#   gt_compose logs -f auth
#   gt_compose exec db psql -U postgres
#
# This wrapper ensures:
#   1. All compose commands use /opt/gametaverns/.env (single source of truth)
#   2. Correct compose file is referenced regardless of current directory
#   3. No environment variable drift between files
#
# =============================================================================

# Canonical paths - NEVER CHANGE THESE
GT_INSTALL_DIR="${GT_INSTALL_DIR:-/opt/gametaverns}"
GT_ENV_FILE="${GT_INSTALL_DIR}/.env"
GT_COMPOSE_FILE="${GT_INSTALL_DIR}/deploy/supabase-selfhosted/docker-compose.yml"

# Validate paths exist
_gt_validate() {
    if [ ! -f "$GT_ENV_FILE" ]; then
        echo "ERROR: .env file not found at $GT_ENV_FILE" >&2
        echo "Run install.sh first to generate configuration." >&2
        return 1
    fi
    if [ ! -f "$GT_COMPOSE_FILE" ]; then
        echo "ERROR: docker-compose.yml not found at $GT_COMPOSE_FILE" >&2
        return 1
    fi
    return 0
}

# Main wrapper function
gt_compose() {
    _gt_validate || return 1
    docker compose --env-file "$GT_ENV_FILE" -f "$GT_COMPOSE_FILE" "$@"
}

# Convenience aliases
gt_up() { gt_compose up -d "$@"; }
gt_down() { gt_compose down "$@"; }
gt_logs() { gt_compose logs -f "$@"; }
gt_restart() { gt_compose restart "$@"; }
gt_ps() { gt_compose ps "$@"; }
gt_exec() { gt_compose exec "$@"; }

# Export for subshells
export -f gt_compose gt_up gt_down gt_logs gt_restart gt_ps gt_exec _gt_validate 2>/dev/null || true
export GT_INSTALL_DIR GT_ENV_FILE GT_COMPOSE_FILE

# If sourced, inform user
if [[ "${BASH_SOURCE[0]}" != "${0}" ]]; then
    echo "GameTaverns compose wrapper loaded. Use 'gt_compose' instead of 'docker compose'."
fi
