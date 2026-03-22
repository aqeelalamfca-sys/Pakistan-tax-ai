#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

source "$SCRIPT_DIR/_config.sh" 2>/dev/null || true

APP_NAME="pakistan-tax-ai"
REMOTE_PATH="${APP_PATH:-/opt/pakistan-tax-ai}"
VPS="${VPS_USER:-root}@${VPS_HOST:?Set VPS_HOST in .env.production or devops/_config.sh}"
COMPOSE_FILE="infra/docker-compose.prod.yml"
ENV_FILE=".env.production"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1" >&2; }
info() { echo -e "${BLUE}[→]${NC} $1"; }

ssh_cmd() {
    ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "$VPS" "$@"
}

cmd_push() {
    local msg="${1:-update: $(date +%Y-%m-%d_%H:%M)}"
    info "Pushing to GitHub..."
    cd "$PROJECT_ROOT"
    git add -A
    git diff --cached --quiet && { warn "Nothing to commit"; return 0; }
    git commit -m "$msg"
    git push origin "$(git branch --show-current)"
    log "Pushed to GitHub: $msg"
}

cmd_deploy() {
    info "Full deployment to VPS..."
    ssh_cmd "bash -s" <<DEPLOY
set -euo pipefail
cd $REMOTE_PATH/app

echo "[1/6] Pulling latest from main..."
git fetch origin main
git reset --hard origin/main

echo "[2/6] Loading environment..."
set -a; source $REMOTE_PATH/.env.production; set +a
export COMPOSE_PROJECT_NAME=$APP_NAME

echo "[3/6] Building containers..."
docker compose -f $COMPOSE_FILE --env-file $REMOTE_PATH/.env.production build --no-cache

echo "[4/6] Stopping old containers..."
docker compose -f $COMPOSE_FILE --env-file $REMOTE_PATH/.env.production down --remove-orphans || true

echo "[5/6] Starting new containers..."
docker compose -f $COMPOSE_FILE --env-file $REMOTE_PATH/.env.production up -d

echo "[6/6] Waiting for health..."
sleep 15
docker ps --filter "name=pakistan-tax-ai" --format "table {{.Names}}\t{{.Status}}"

echo ""
if curl -sf http://localhost:4080/api/healthz > /dev/null; then
    echo "✅ Deployment successful — app is healthy"
else
    echo "⚠️  Health check pending — containers may still be starting"
fi
DEPLOY
    log "Deployment complete"
}

cmd_deploy_quick() {
    info "Quick deploy (pull + restart, no rebuild)..."
    ssh_cmd "bash -s" <<QUICK
set -euo pipefail
cd $REMOTE_PATH/app
git fetch origin main
git reset --hard origin/main
export COMPOSE_PROJECT_NAME=$APP_NAME
docker compose -f $COMPOSE_FILE --env-file $REMOTE_PATH/.env.production up -d --force-recreate
sleep 10
docker ps --filter "name=pakistan-tax-ai" --format "table {{.Names}}\t{{.Status}}"
curl -sf http://localhost:4080/api/healthz && echo "✅ Healthy" || echo "⚠️ Starting..."
QUICK
    log "Quick deploy complete"
}

cmd_health() {
    info "Checking health..."
    ssh_cmd "bash -s" <<'HEALTH'
echo "=== Container Status ==="
docker ps --filter "name=pakistan-tax-ai" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "=== Health Endpoint ==="
curl -sf http://localhost:4080/api/healthz 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "Health endpoint not responding"
echo ""
echo "=== Resource Usage ==="
docker stats --no-stream --filter "name=pakistan-tax-ai" --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
HEALTH
}

cmd_status() {
    info "System status..."
    ssh_cmd "docker ps -a --filter 'name=pakistan-tax-ai' --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}'"
}

resolve_container() {
    local name="${1:-app}"
    case "$name" in
        app|api|backend)   echo "pakistan-tax-ai-app" ;;
        nginx|frontend|web) echo "pakistan-tax-ai-nginx" ;;
        db|postgres|database) echo "pakistan-tax-ai-db" ;;
        pakistan-tax-ai-*)  echo "$name" ;;
        *)                 echo "pakistan-tax-ai-$name" ;;
    esac
}

cmd_logs() {
    local service=$(resolve_container "${1:-app}")
    local lines="${2:-100}"
    info "Fetching logs for $service (last $lines lines)..."
    ssh_cmd "docker logs --tail $lines $service 2>&1"
}

cmd_restart() {
    local service="${1:-}"
    if [ -n "$service" ]; then
        local container=$(resolve_container "$service")
        info "Restarting $container..."
        ssh_cmd "docker restart $container"
    else
        info "Restarting all services..."
        ssh_cmd "cd $REMOTE_PATH/app && COMPOSE_PROJECT_NAME=$APP_NAME docker compose -f $COMPOSE_FILE --env-file $REMOTE_PATH/.env.production restart"
    fi
    log "Restart complete"
}

cmd_rebuild() {
    local service="${1:-}"
    info "Rebuilding${service:+ $service}..."
    if [ -n "$service" ]; then
        local container=$(resolve_container "$service")
        ssh_cmd "cd $REMOTE_PATH/app && COMPOSE_PROJECT_NAME=$APP_NAME docker compose -f $COMPOSE_FILE --env-file $REMOTE_PATH/.env.production build --no-cache $container && docker compose -f $COMPOSE_FILE --env-file $REMOTE_PATH/.env.production up -d $container"
    else
        ssh_cmd "cd $REMOTE_PATH/app && COMPOSE_PROJECT_NAME=$APP_NAME docker compose -f $COMPOSE_FILE --env-file $REMOTE_PATH/.env.production build --no-cache && docker compose -f $COMPOSE_FILE --env-file $REMOTE_PATH/.env.production up -d"
    fi
    log "Rebuild complete"
}

cmd_backup() {
    info "Backing up database..."
    local ts=$(date +%Y%m%d_%H%M%S)
    ssh_cmd "bash -s" <<BACKUP
set -euo pipefail
mkdir -p $REMOTE_PATH/backups
set -a; source $REMOTE_PATH/.env.production; set +a
docker exec pakistan-tax-ai-db pg_dump -U \${DB_USER:-taxai_user} \${DB_NAME:-pakistan_tax_ai} | gzip > $REMOTE_PATH/backups/db_backup_${ts}.sql.gz
ls -lh $REMOTE_PATH/backups/db_backup_${ts}.sql.gz
echo "Cleaning up old backups (keeping last 10)..."
cd $REMOTE_PATH/backups && ls -t db_backup_*.sql.gz | tail -n +11 | xargs rm -f 2>/dev/null || true
echo "✅ Backup saved: db_backup_${ts}.sql.gz"
BACKUP
    log "Backup complete"
}

cmd_rollback() {
    info "Rolling back to previous commit..."
    ssh_cmd "bash -s" <<ROLLBACK
set -euo pipefail
cd $REMOTE_PATH/app
CURRENT=\$(git rev-parse --short HEAD)
PREV=\$(git rev-parse --short HEAD~1)
echo "Current: \$CURRENT"
echo "Rolling back to: \$PREV"
git reset --hard HEAD~1
export COMPOSE_PROJECT_NAME=$APP_NAME
docker compose -f $COMPOSE_FILE --env-file $REMOTE_PATH/.env.production build --no-cache
docker compose -f $COMPOSE_FILE --env-file $REMOTE_PATH/.env.production up -d
sleep 15
if curl -sf http://localhost:4080/api/healthz > /dev/null; then
    echo "✅ Rollback successful — now on \$PREV"
else
    echo "⚠️  Rollback applied but health check pending"
fi
ROLLBACK
    log "Rollback complete"
}

cmd_ssh() {
    local remote_cmd="${1:-}"
    if [ -n "$remote_cmd" ]; then
        ssh_cmd "$remote_cmd"
    else
        info "Opening SSH session..."
        ssh "$VPS"
    fi
}

cmd_setup_vps() {
    info "Setting up VPS directory structure..."
    ssh_cmd "bash -s" <<SETUP
set -euo pipefail
echo "Creating directory structure..."
mkdir -p $REMOTE_PATH/{app,backups,logs}

if [ ! -d "$REMOTE_PATH/app/.git" ]; then
    echo "Cloning repository..."
    git clone https://github.com/aqeelalamfca-sys/Pakistan-tax-ai.git $REMOTE_PATH/app
else
    echo "Repository already exists, pulling latest..."
    cd $REMOTE_PATH/app && git pull origin main
fi

if [ ! -f "$REMOTE_PATH/.env.production" ]; then
    echo "⚠️  No .env.production found. Copy .env.example and configure it:"
    echo "    scp .env.example $VPS:$REMOTE_PATH/.env.production"
    echo "    Then edit: ssh $VPS nano $REMOTE_PATH/.env.production"
fi

echo ""
echo "✅ VPS structure ready at $REMOTE_PATH"
ls -la $REMOTE_PATH/
SETUP
    log "VPS setup complete"
}

cmd_setup_ssl() {
    info "Setting up SSL for tax.auditwise.tech..."
    ssh_cmd "bash -s" <<SSL
set -euo pipefail
if ! command -v certbot &> /dev/null; then
    echo "Installing certbot..."
    apt-get update && apt-get install -y certbot python3-certbot-nginx
fi

echo "Obtaining SSL certificate..."
certbot certonly --nginx -d tax.auditwise.tech --non-interactive --agree-tos --email admin@auditwise.tech || \
certbot certonly --standalone -d tax.auditwise.tech --non-interactive --agree-tos --email admin@auditwise.tech

echo "Copying nginx config..."
cp $REMOTE_PATH/app/infra/nginx.tax.auditwise.tech.conf /etc/nginx/sites-available/tax.auditwise.tech
ln -sf /etc/nginx/sites-available/tax.auditwise.tech /etc/nginx/sites-enabled/

echo "Testing nginx config..."
nginx -t

echo "Reloading nginx..."
systemctl reload nginx

echo "✅ SSL setup complete for tax.auditwise.tech"
SSL
    log "SSL setup complete"
}

usage() {
    echo ""
    echo -e "${BLUE}Pakistan Tax AI — DevOps Control${NC}"
    echo ""
    echo "Usage: bash devops/control.sh <command> [args...]"
    echo ""
    echo "Commands:"
    echo "  push [message]       Push code to GitHub"
    echo "  deploy               Full deploy (build + restart)"
    echo "  deploy-quick         Quick deploy (pull + recreate, no rebuild)"
    echo "  health               Check system health"
    echo "  status               Show container status"
    echo "  logs [service] [n]   Show logs (default: app, 100 lines)"
    echo "  restart [service]    Restart service(s)"
    echo "  rebuild [service]    Rebuild and restart service(s)"
    echo "  backup               Backup database"
    echo "  rollback             Rollback to previous commit"
    echo "  ssh [command]        SSH to VPS (or run remote command)"
    echo "  setup-vps            Initial VPS directory setup"
    echo "  setup-ssl            Setup SSL certificate"
    echo ""
    echo "Examples:"
    echo "  bash devops/control.sh push 'fix tax rule validation'"
    echo "  bash devops/control.sh deploy"
    echo "  bash devops/control.sh logs app 200"
    echo "  bash devops/control.sh restart nginx"
    echo "  bash devops/control.sh ssh 'docker ps'"
    echo ""
}

case "${1:-}" in
    push)           shift; cmd_push "$@" ;;
    deploy)         cmd_deploy ;;
    deploy-quick)   cmd_deploy_quick ;;
    health)         cmd_health ;;
    status)         cmd_status ;;
    logs)           shift; cmd_logs "$@" ;;
    restart)        shift; cmd_restart "$@" ;;
    rebuild)        shift; cmd_rebuild "$@" ;;
    backup)         cmd_backup ;;
    rollback)       cmd_rollback ;;
    ssh)            shift; cmd_ssh "$@" ;;
    setup-vps)      cmd_setup_vps ;;
    setup-ssl)      cmd_setup_ssl ;;
    *)              usage ;;
esac
