#!/usr/bin/env bash
set -euo pipefail

APP_PATH="/opt/pakistan-tax-ai"
APP_DIR="$APP_PATH/app"
DOMAIN="tax.auditwise.tech"
NGINX_PORT=4080

echo "================================================="
echo "  PAKISTAN TAX AI — QUICK VPS SETUP"
echo "================================================="

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: Run as root: sudo bash vps-quickstart.sh"
    exit 1
fi

echo ""
echo "[1/7] Installing prerequisites..."
apt-get update -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx 2>/dev/null || true
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker && systemctl start docker
fi
echo "  Done"

echo ""
echo "[2/7] Creating directories..."
mkdir -p "$APP_PATH"/{backups,logs}

if [ ! -d "$APP_DIR/.git" ]; then
    echo "  Cloning repository..."
    git clone https://github.com/aqeelalamfca-sys/Pakistan-tax-ai.git "$APP_DIR"
else
    echo "  Updating repository..."
    cd "$APP_DIR" && git fetch origin main && git reset --hard origin/main
fi
echo "  Done"

echo ""
echo "[3/7] Creating missing production files..."

mkdir -p "$APP_DIR/infra" "$APP_DIR/devops"

cat > "$APP_DIR/infra/nginx.prod.conf" << 'NGINXCONF'
upstream api_backend {
    server pakistan-tax-ai-app:8080;
}
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    location /api/ {
        proxy_pass http://api_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
        client_max_body_size 50M;
    }
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache";
    }
}
NGINXCONF

cat > "$APP_DIR/infra/Dockerfile.frontend.prod" << 'DOCKFRONT'
FROM node:24-slim AS base
WORKDIR /app
RUN npm install -g pnpm@10

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
ENV NODE_ENV=production
ENV BASE_PATH=/
ENV PORT=3000
RUN pnpm --filter @workspace/tax-engine run build

FROM nginx:alpine AS runner
COPY --from=build /app/artifacts/tax-engine/dist/public /usr/share/nginx/html
COPY infra/nginx.prod.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
DOCKFRONT

cat > "$APP_DIR/infra/docker-compose.prod.yml" << 'COMPOSEPROD'
version: "3.9"

x-common: &common
  restart: unless-stopped
  logging:
    driver: json-file
    options:
      max-size: "10m"
      max-file: "5"

services:
  pakistan-tax-ai-db:
    <<: *common
    image: postgres:16-alpine
    container_name: pakistan-tax-ai-db
    environment:
      POSTGRES_DB: ${DB_NAME:-pakistan_tax_ai}
      POSTGRES_USER: ${DB_USER:-taxai_user}
      POSTGRES_PASSWORD: ${DB_PASSWORD:?DB_PASSWORD is required}
    volumes:
      - pakistan_tax_ai_postgres_data:/var/lib/postgresql/data
    networks:
      - pakistan_tax_ai_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-taxai_user} -d ${DB_NAME:-pakistan_tax_ai}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  pakistan-tax-ai-app:
    <<: *common
    build:
      context: ..
      dockerfile: infra/Dockerfile.api
    container_name: pakistan-tax-ai-app
    environment:
      NODE_ENV: production
      PORT: 8080
      DATABASE_URL: postgresql://${DB_USER:-taxai_user}:${DB_PASSWORD}@pakistan-tax-ai-db:5432/${DB_NAME:-pakistan_tax_ai}
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET is required}
      SESSION_SECRET: ${SESSION_SECRET:-}
      ENCRYPTION_MASTER_KEY: ${ENCRYPTION_MASTER_KEY:-}
      AI_PROVIDER: ${AI_PROVIDER:-openai}
      OPENAI_API_KEY: ${OPENAI_API_KEY:-}
      UPLOAD_DIR: /app/uploads
      VAULT_DIR: /app/vault
    volumes:
      - pakistan_tax_ai_uploads:/app/uploads
      - pakistan_tax_ai_vault:/app/vault
    networks:
      - pakistan_tax_ai_network
    depends_on:
      pakistan-tax-ai-db:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:8080/api/healthz || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  pakistan-tax-ai-nginx:
    <<: *common
    build:
      context: ..
      dockerfile: infra/Dockerfile.frontend.prod
    container_name: pakistan-tax-ai-nginx
    ports:
      - "${NGINX_PORT:-4080}:80"
    networks:
      - pakistan_tax_ai_network
    depends_on:
      pakistan-tax-ai-app:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost/api/healthz || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  pakistan_tax_ai_postgres_data:
    name: pakistan_tax_ai_postgres_data
  pakistan_tax_ai_uploads:
    name: pakistan_tax_ai_uploads
  pakistan_tax_ai_vault:
    name: pakistan_tax_ai_vault

networks:
  pakistan_tax_ai_network:
    name: pakistan_tax_ai_network
    driver: bridge
COMPOSEPROD

echo "  Created: nginx.prod.conf, Dockerfile.frontend.prod, docker-compose.prod.yml"

echo ""
echo "[4/7] Generating .env.production..."
if [ -f "$APP_PATH/.env.production" ]; then
    echo "  Already exists — keeping current file"
else
    DB_PASS=$(openssl rand -hex 24)
    JWT=$(openssl rand -hex 32)
    SESS=$(openssl rand -hex 32)
    ENC=$(openssl rand -hex 16)
    cat > "$APP_PATH/.env.production" << ENVFILE
DB_NAME=pakistan_tax_ai
DB_USER=taxai_user
DB_PASSWORD=$DB_PASS
DATABASE_URL=postgresql://taxai_user:$DB_PASS@pakistan-tax-ai-db:5432/pakistan_tax_ai
JWT_SECRET=$JWT
SESSION_SECRET=$SESS
ENCRYPTION_MASTER_KEY=$ENC
NODE_ENV=production
PORT=8080
NGINX_PORT=$NGINX_PORT
DOMAIN=$DOMAIN
AI_PROVIDER=openai
OPENAI_API_KEY=
UPLOAD_DIR=/app/uploads
VAULT_DIR=/app/vault
ENVFILE
    chmod 600 "$APP_PATH/.env.production"
    echo "  Generated with secure random secrets"
fi

echo ""
echo "[5/7] Building and starting Docker containers..."
cd "$APP_DIR"
export COMPOSE_PROJECT_NAME=pakistan-tax-ai
docker compose -f infra/docker-compose.prod.yml --env-file "$APP_PATH/.env.production" build --no-cache
docker compose -f infra/docker-compose.prod.yml --env-file "$APP_PATH/.env.production" down --remove-orphans 2>/dev/null || true
docker compose -f infra/docker-compose.prod.yml --env-file "$APP_PATH/.env.production" up -d

echo "  Waiting 30s for containers to start..."
sleep 30
echo ""
docker ps --filter "name=pakistan-tax-ai" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
if curl -sf "http://localhost:$NGINX_PORT/api/healthz" > /dev/null 2>&1; then
    echo "  Health check: PASSED"
else
    echo "  Health check: pending (may need another 30s)"
fi

echo ""
echo "[6/7] Configuring Nginx for $DOMAIN..."

VPS_IP=$(curl -sf https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')

cat > "/etc/nginx/sites-available/$DOMAIN" << NGINXSITE
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
NGINXSITE

ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/"
nginx -t 2>/dev/null && systemctl reload nginx
echo "  Nginx configured (HTTP mode)"

echo ""
echo "[7/7] Setting up deploy key..."
DEPLOY_KEY="$HOME/.ssh/pakistan_tax_ai_deploy"
if [ ! -f "$DEPLOY_KEY" ]; then
    mkdir -p "$HOME/.ssh"
    ssh-keygen -t ed25519 -f "$DEPLOY_KEY" -N "" -C "pakistan-tax-ai-deploy" > /dev/null 2>&1
    grep -qf "${DEPLOY_KEY}.pub" "$HOME/.ssh/authorized_keys" 2>/dev/null || cat "${DEPLOY_KEY}.pub" >> "$HOME/.ssh/authorized_keys"
fi
echo "  Deploy key ready"

echo ""
echo "================================================="
echo "  SETUP COMPLETE!"
echo "================================================="
echo ""
echo "  App:    http://$DOMAIN"
echo "  Health: http://$DOMAIN/health"
echo "  VPS IP: $VPS_IP"
echo ""
echo "  NEXT STEPS:"
echo ""
echo "  1. SSL — Run this after DNS A record points to $VPS_IP:"
echo "     certbot --nginx -d $DOMAIN --agree-tos --email admin@auditwise.tech"
echo ""
echo "  2. GitHub Actions — Add these secrets at:"
echo "     https://github.com/aqeelalamfca-sys/Pakistan-tax-ai/settings/secrets/actions"
echo ""
echo "     VPS_HOST = $VPS_IP"
echo "     VPS_USER = root"
echo "     VPS_SSH_KEY = (key below)"
echo ""
echo "--- PRIVATE KEY (copy ALL lines including BEGIN/END) ---"
cat "$DEPLOY_KEY"
echo "--- END KEY ---"
echo ""
