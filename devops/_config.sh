#!/usr/bin/env bash
# DevOps Config — loads from .env.production or environment

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

if [ -f "$PROJECT_ROOT/.env.production" ]; then
    set -a
    source "$PROJECT_ROOT/.env.production"
    set +a
fi

export VPS_HOST="${VPS_HOST:-}"
export VPS_USER="${VPS_USER:-root}"
export APP_PATH="${APP_PATH:-/opt/pakistan-tax-ai}"
export DOMAIN="${DOMAIN:-tax.auditwise.tech}"
