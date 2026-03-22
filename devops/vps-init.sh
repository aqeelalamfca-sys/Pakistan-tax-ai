#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1" >&2; }
info() { echo -e "${BLUE}[→]${NC} $1"; }
header() { echo -e "\n${CYAN}${BOLD}═══════════════════════════════════════════════════${NC}"; echo -e "${CYAN}${BOLD}  $1${NC}"; echo -e "${CYAN}${BOLD}═══════════════════════════════════════════════════${NC}\n"; }

APP_NAME="pakistan-tax-ai"
APP_PATH="/opt/pakistan-tax-ai"
GITHUB_REPO="https://github.com/aqeelalamfca-sys/Pakistan-tax-ai.git"
DOMAIN="tax.auditwise.tech"
COMPOSE_FILE="infra/docker-compose.prod.yml"
NGINX_PORT=4080

header "PAKISTAN TAX AI — VPS FULL SETUP"
echo -e "  Repository : ${BOLD}$GITHUB_REPO${NC}"
echo -e "  Domain     : ${BOLD}https://$DOMAIN${NC}"
echo -e "  VPS Path   : ${BOLD}$APP_PATH${NC}"
echo ""

if [ "$(id -u)" -ne 0 ]; then
    err "This script must be run as root. Use: sudo bash vps-init.sh"
    exit 1
fi

header "STEP 1/8 — Installing Prerequisites"

if command -v docker &>/dev/null; then
    log "Docker already installed: $(docker --version)"
else
    info "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
    log "Docker installed"
fi

if command -v docker compose &>/dev/null || docker compose version &>/dev/null 2>&1; then
    log "Docker Compose available"
else
    info "Installing Docker Compose plugin..."
    apt-get update -qq && apt-get install -y -qq docker-compose-plugin
    log "Docker Compose installed"
fi

if command -v nginx &>/dev/null; then
    log "Nginx already installed"
else
    info "Installing Nginx..."
    apt-get update -qq && apt-get install -y -qq nginx
    systemctl enable nginx
    systemctl start nginx
    log "Nginx installed"
fi

if command -v certbot &>/dev/null; then
    log "Certbot already installed"
else
    info "Installing Certbot..."
    apt-get install -y -qq certbot python3-certbot-nginx
    log "Certbot installed"
fi

if command -v git &>/dev/null; then
    log "Git already installed"
else
    apt-get install -y -qq git
    log "Git installed"
fi

header "STEP 2/8 — Creating Directory Structure"

mkdir -p "$APP_PATH"/{backups,logs}
log "Created $APP_PATH/backups"
log "Created $APP_PATH/logs"

header "STEP 3/8 — Cloning Repository"

if [ -d "$APP_PATH/app/.git" ]; then
    warn "Repository already exists, pulling latest..."
    cd "$APP_PATH/app"
    git fetch origin main
    git reset --hard origin/main
    log "Updated to latest main"
else
    info "Cloning $GITHUB_REPO ..."
    git clone "$GITHUB_REPO" "$APP_PATH/app"
    log "Repository cloned"
fi

cd "$APP_PATH/app"

header "STEP 4/8 — Generating Production Environment"

if [ -f "$APP_PATH/.env.production" ]; then
    warn ".env.production already exists — keeping existing file"
    warn "To regenerate, delete it and re-run this script"
else
    info "Generating secure secrets..."
    
    DB_PASSWORD=$(openssl rand -hex 24)
    JWT_SECRET=$(openssl rand -hex 32)
    SESSION_SECRET=$(openssl rand -hex 32)
    ENCRYPTION_KEY=$(openssl rand -hex 16)

    cat > "$APP_PATH/.env.production" <<ENVFILE
# ============================================================
# Pakistan Tax AI — Production Environment
# Auto-generated on $(date '+%Y-%m-%d %H:%M:%S')
# ============================================================

# --- Database ---
DB_NAME=pakistan_tax_ai
DB_USER=taxai_user
DB_PASSWORD=$DB_PASSWORD
DATABASE_URL=postgresql://taxai_user:$DB_PASSWORD@pakistan-tax-ai-db:5432/pakistan_tax_ai

# --- Security ---
JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET
ENCRYPTION_MASTER_KEY=$ENCRYPTION_KEY

# --- App ---
NODE_ENV=production
PORT=8080
NGINX_PORT=$NGINX_PORT
DOMAIN=$DOMAIN

# --- AI (add your key later) ---
AI_PROVIDER=openai
OPENAI_API_KEY=

# --- File Storage ---
UPLOAD_DIR=/app/uploads
VAULT_DIR=/app/vault

# --- Redis (optional) ---
REDIS_URL=
ENVFILE

    chmod 600 "$APP_PATH/.env.production"
    log "Generated .env.production with secure random secrets"
    log "File permissions set to 600 (owner-only)"
fi

header "STEP 5/8 — Building & Starting Containers"

cd "$APP_PATH/app"
export COMPOSE_PROJECT_NAME=$APP_NAME

info "Building containers (this may take 3-5 minutes on first run)..."
docker compose -f "$COMPOSE_FILE" --env-file "$APP_PATH/.env.production" build --no-cache

info "Starting containers..."
docker compose -f "$COMPOSE_FILE" --env-file "$APP_PATH/.env.production" down --remove-orphans 2>/dev/null || true
docker compose -f "$COMPOSE_FILE" --env-file "$APP_PATH/.env.production" up -d

log "Containers started"

info "Waiting 30 seconds for services to initialize..."
sleep 30

echo ""
docker ps --filter "name=pakistan-tax-ai" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

if curl -sf "http://localhost:$NGINX_PORT/api/healthz" > /dev/null 2>&1; then
    log "Health check PASSED — app is running"
else
    warn "Health check pending — containers may still be starting"
    warn "Check in 30 seconds: curl http://localhost:$NGINX_PORT/api/healthz"
fi

header "STEP 6/8 — Setting Up SSL Certificate"

DOMAIN_IP=$(dig +short "$DOMAIN" 2>/dev/null | head -1)
VPS_IP=$(curl -sf https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')

if [ -z "$DOMAIN_IP" ]; then
    warn "DNS for $DOMAIN not yet configured"
    warn "Add an A record: $DOMAIN → $VPS_IP"
    warn "Then re-run: certbot certonly --nginx -d $DOMAIN"
    warn "Skipping SSL setup for now..."
    SSL_DONE=false
elif [ "$DOMAIN_IP" != "$VPS_IP" ]; then
    warn "DNS points to $DOMAIN_IP but this VPS is $VPS_IP"
    warn "Update the A record to point to $VPS_IP"
    warn "Skipping SSL setup for now..."
    SSL_DONE=false
else
    log "DNS verified: $DOMAIN → $DOMAIN_IP"
    
    info "Obtaining SSL certificate..."
    if certbot certonly --standalone --preferred-challenges http -d "$DOMAIN" --non-interactive --agree-tos --email "admin@auditwise.tech" --pre-hook "systemctl stop nginx" --post-hook "systemctl start nginx" 2>/dev/null; then
        log "SSL certificate obtained"
        SSL_DONE=true
    else
        warn "Standalone certbot failed, trying nginx plugin..."
        if certbot certonly --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@auditwise.tech" 2>/dev/null; then
            log "SSL certificate obtained"
            SSL_DONE=true
        else
            warn "SSL certificate failed — you may need to configure manually"
            SSL_DONE=false
        fi
    fi
fi

header "STEP 7/8 — Configuring Nginx Reverse Proxy"

cp "$APP_PATH/app/infra/nginx.tax.auditwise.tech.conf" "/etc/nginx/sites-available/$DOMAIN"

if [ "$SSL_DONE" = false ]; then
    info "Creating HTTP-only config (SSL not ready yet)..."
    cat > "/etc/nginx/sites-available/$DOMAIN" <<NGINX_TEMP
server {
    listen 80;
    server_name $DOMAIN;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:$NGINX_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location = /health {
        proxy_pass http://127.0.0.1:$NGINX_PORT/api/healthz;
        access_log off;
    }
}
NGINX_TEMP
    warn "Using HTTP-only config until SSL is ready"
fi

ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/"

if nginx -t 2>/dev/null; then
    systemctl reload nginx
    log "Nginx configured and reloaded"
else
    err "Nginx config test failed — check: nginx -t"
fi

header "STEP 8/8 — Setting Up GitHub Deploy Key"

DEPLOY_KEY="$HOME/.ssh/pakistan_tax_ai_deploy"
if [ ! -f "$DEPLOY_KEY" ]; then
    ssh-keygen -t ed25519 -f "$DEPLOY_KEY" -N "" -C "pakistan-tax-ai-deploy" > /dev/null 2>&1
    
    if ! grep -qf "${DEPLOY_KEY}.pub" "$HOME/.ssh/authorized_keys" 2>/dev/null; then
        cat "${DEPLOY_KEY}.pub" >> "$HOME/.ssh/authorized_keys"
    fi
    
    log "Deploy SSH key generated"
else
    log "Deploy SSH key already exists"
fi

header "SETUP COMPLETE"

echo -e "${GREEN}${BOLD}Pakistan Tax AI is deployed!${NC}"
echo ""
echo -e "  App URL      : ${BOLD}http://$DOMAIN${NC}"
if [ "$SSL_DONE" = true ]; then
echo -e "  Secure URL   : ${BOLD}https://$DOMAIN${NC}"
fi
echo -e "  Health Check : ${BOLD}http://$DOMAIN/health${NC}"
echo -e "  VPS Path     : ${BOLD}$APP_PATH${NC}"
echo -e "  Env File     : ${BOLD}$APP_PATH/.env.production${NC}"
echo ""

echo -e "${YELLOW}${BOLD}=== ACTION REQUIRED: GitHub Auto-Deploy ===${NC}"
echo ""
echo "Go to: https://github.com/aqeelalamfca-sys/Pakistan-tax-ai/settings/secrets/actions"
echo "Add these 3 repository secrets:"
echo ""
echo -e "  1. ${BOLD}VPS_HOST${NC}    = $VPS_IP"
echo -e "  2. ${BOLD}VPS_USER${NC}    = root"
echo -e "  3. ${BOLD}VPS_SSH_KEY${NC} = (copy the key below)"
echo ""
echo "─── PRIVATE KEY (copy everything including BEGIN/END lines) ───"
cat "$DEPLOY_KEY"
echo "───────────────────────────────────────────────────────────────"
echo ""

if [ "$SSL_DONE" = false ]; then
echo -e "${YELLOW}${BOLD}=== ACTION REQUIRED: SSL Certificate ===${NC}"
echo ""
echo "1. Add DNS A record: $DOMAIN → $VPS_IP"
echo "2. Wait for DNS propagation (5-15 min)"
echo "3. Run:"
echo "   certbot certonly --nginx -d $DOMAIN --agree-tos --email admin@auditwise.tech"
echo "4. Then restore the full SSL config:"
echo "   cp $APP_PATH/app/infra/nginx.tax.auditwise.tech.conf /etc/nginx/sites-available/$DOMAIN"
echo "   systemctl reload nginx"
echo ""
fi

echo -e "${BLUE}${BOLD}=== USEFUL COMMANDS ===${NC}"
echo ""
echo "  View logs     : docker logs --tail 100 pakistan-tax-ai-app"
echo "  Restart app   : docker restart pakistan-tax-ai-app"
echo "  Rebuild all   : cd $APP_PATH/app && COMPOSE_PROJECT_NAME=$APP_NAME docker compose -f $COMPOSE_FILE --env-file $APP_PATH/.env.production up -d --build"
echo "  Backup DB     : docker exec pakistan-tax-ai-db pg_dump -U taxai_user pakistan_tax_ai | gzip > $APP_PATH/backups/backup_\$(date +%Y%m%d).sql.gz"
echo "  Health check  : curl http://localhost:$NGINX_PORT/api/healthz"
echo ""
log "Setup finished at $(date '+%Y-%m-%d %H:%M:%S')"
