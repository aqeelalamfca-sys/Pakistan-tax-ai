# Tax Intelligence Engine — Pakistan AI Tax Software

## Overview

A production-grade, Pakistan-focused AI tax computation platform built as a pnpm monorepo. The system covers the complete tax engagement lifecycle from client onboarding through partner approval with an integrated AI drafting assistant grounded in a Super Admin Knowledge Vault.

**Brand Color:** Pakistan Green `#2D6A4F`
**Deployment Target:** Hostinger VPS via Docker/Nginx (GitHub is source of truth — never deploy directly from Replit)

---

## Architecture

```
pnpm-workspace/
├── artifacts/
│   ├── api-server/       Express 5 backend (port 8080)
│   └── tax-engine/       React + Vite frontend (port from $PORT)
├── lib/
│   ├── api-client-react/ Orval-generated React Query hooks + Zod schemas
│   ├── api-spec/         OpenAPI 3.0 specification (19+ modules)
│   └── db/               Drizzle ORM + PostgreSQL (15 schema files)
├── scripts/              Seed + utility scripts
├── infra/                Docker, docker-compose, Nginx
└── .github/workflows/    CI/CD (GitHub Actions)
```

---

## Running Services

| Service      | Port  | Purpose                              |
|-------------|-------|--------------------------------------|
| API Server  | 8080  | Express 5, all REST endpoints        |
| Tax Engine  | $PORT | React + Vite frontend                |

The Vite dev server proxies `/api/*` → `localhost:8080` for seamless development.

---

## Modules Implemented

### Backend API Routes (`artifacts/api-server/src/routes/`)
| File             | Module                              |
|-----------------|-------------------------------------|
| `auth.ts`        | JWT login, logout, /me, MFA setup  |
| `clients.ts`     | Client onboarding (CRUD + soft delete) |
| `engagements.ts` | Engagement workflow + status changes |
| `uploads.ts`     | File uploads (multer, SHA256 hash)  |
| `validation.ts`  | Structural + arithmetic + duplicate checks |
| `mapping.ts`     | Account code / ledger mapping       |
| `rules.ts`       | Tax rule engine + risk flag generation |
| `computation.ts` | Tax computation workspace (lock/unlock) |
| `withholding.ts` | WHT review with exception detection |
| `risks.ts`       | Risk register (HIGH/MEDIUM/LOW)     |
| `reviews.ts`     | Review notes + partner approval locking |
| `ai.ts`          | AI drafting assistant (vault-grounded, staged) |
| `vault.ts`       | Super Admin Knowledge Vault         |
| `audit.ts`       | Immutable audit log viewer          |
| `users.ts`       | User management (RBAC-protected)    |

### Frontend Pages (`artifacts/tax-engine/src/pages/`)
| Page | Route | Description |
|------|-------|-------------|
| `login.tsx` | `/login` | JWT login with MFA support |
| `dashboard.tsx` | `/` | KPI overview with charts |
| `clients.tsx` | `/clients` | Client list with search |
| `client-detail.tsx` | `/clients/:id` | Client profile + engagement history |
| `engagements.tsx` | `/engagements` | Engagement list with status filters |
| `engagement-workspace.tsx` | `/engagements/:id` | Full 9-tab workspace (see below) |
| `tax-rules.tsx` | `/rules` | Tax rules library with create/filter |
| `audit-logs.tsx` | `/audit` | Immutable audit trail with filters + CSV export |
| `users.tsx` | `/users` | Team member management with invite |
| `vault.tsx` | `/vault` | Knowledge Vault (SUPER_ADMIN only) |
| `profile.tsx` | `/profile` | User profile, change password, MFA status |

### Engagement Workspace Tabs (9 tabs)
1. **Overview** — Stats cards, workflow progress stepper, engagement details, financial summary
2. **Upload Center** — Upload trial balances, ledgers, schedules (multer, SHA256)
3. **Validation** — Run structural/arithmetic/duplicate checks
4. **Mapping** — Map chart-of-accounts to Pakistan tax return line items
5. **Computation** — Tax computation workspace with lock/unlock
6. **WHT Review** — Withholding tax register with exception detection
7. **Risk Register** — Risk items with severity, mitigate/accept/reopen actions
8. **Review Notes** — Review notes + partner approval workflow
9. **AI Assistant** — Vault-grounded drafting with staging area

---

## Authentication & RBAC

**Roles (8 levels):**
```
SUPER_ADMIN > FIRM_ADMIN > PARTNER > TAX_MANAGER > SENIOR > ASSOCIATE > REVIEWER > CLIENT_USER
```

**JWT:** 8-hour expiry, stored in `localStorage` as `tax_engine_token`
**MFA:** TOTP via speakeasy (optional per user, stored as base32 secret)

---

## Database Schema (PostgreSQL via Drizzle ORM)

15 tables in `lib/db/src/schema/`:
- `firms`, `users` — Multi-tenant firm and user management
- `clients` — Client onboarding with soft delete
- `engagements` — Engagement lifecycle with checklist
- `uploads` — File upload tracking with SHA256
- `validation_results` — Check results per upload
- `account_mappings` — Ledger/account code mapping
- `tax_rules` — PKR-INC-001 to PKR-INC-010 (10 seeded)
- `tax_computations` — Tax computation with lock mechanism
- `withholding_entries` — WHT register with exception flags
- `risk_flags` — Risk register with severity
- `review_notes`, `approvals` — Review workflow
- `ai_runs`, `ai_outputs` — AI generation with staging
- `vault_documents`, `vault_versions` — Knowledge Vault with versioning
- `audit_logs` — Insert-only immutable audit trail

---

## Seed Data

Run: `pnpm --filter @workspace/scripts run seed`

Demo credentials:
```
superadmin@demo.test / Admin@1234  (SUPER_ADMIN)
partner@demo.test    / Partner@1234 (PARTNER)
manager@demo.test    / Manager@1234 (TAX_MANAGER)
senior@demo.test     / Senior@1234  (SENIOR)
```

Seeded with:
- 2 demo firms
- 5 clients (Textile, Tech, Manufacturing, Trading, Individual)
- 5 engagements with various statuses
- 10 Pakistan income tax rules (PKR-INC-001 to PKR-INC-010)
- 4 WHT entries with exceptions
- 5 Knowledge Vault documents

---

## Key Business Rules

- **Computation Lock:** Blocked if any open HIGH severity risks exist
- **Computation Unlock:** Requires reason ≥ 30 characters, logged to audit
- **Partner Approval:** Blocked if open HIGH risks OR open review notes exist
- **AI Outputs:** Always staged (`isPromoted: false`); explicit human promote action required
- **AI References:** Vault documents auto-appended as References section
- **Knowledge Vault:** SUPER_ADMIN only; all actions audited
- **Audit Logs:** Insert-only at service layer (no update/delete routes)
- **WHT Exception:** Flagged when short/over-deduction > PKR 1,000

---

## Infrastructure & DevOps

### Project Identity
| Key | Value |
|-----|-------|
| Project Name | Pakistan Tax AI |
| Live Domain | https://tax.auditwise.tech |
| GitHub Owner | aqeelalamfca-sys |
| GitHub Repo | Pakistan-tax-ai |
| VPS Path | /opt/pakistan-tax-ai |
| Source of Truth | GitHub ONLY |

### File Layout
```
infra/
├── Dockerfile.api                  Multi-stage API image (Node 24)
├── Dockerfile.frontend             Multi-stage frontend image (Nginx Alpine)
├── docker-compose.yml              Dev compose (original, for local use)
├── docker-compose.prod.yml         PRODUCTION compose (isolated names/networks)
├── nginx.conf                      Internal Nginx (container-level SPA + API proxy)
└── nginx.tax.auditwise.tech.conf   VPS host-level Nginx (SSL, domain routing)

devops/
├── _config.sh         Shared config loader
├── control.sh         Master control script (all commands)
├── push.sh            Push to GitHub
├── deploy.sh          Full deploy (build + restart)
├── deploy-quick.sh    Quick deploy (pull + recreate)
├── health.sh          Health check
├── backup.sh          Database backup
├── rollback.sh        Rollback to previous commit
├── logs.sh            View container logs
├── restart.sh         Restart services
└── setup-ssh.sh       SSH key generation

.github/workflows/
├── ci.yml             CI: typecheck + build + Docker build test
└── deploy.yml         CD: auto-deploy to VPS on push to main
```

### Production Isolation (from existing auditwise.tech)
| Resource | Pakistan Tax AI | Existing AuditWise |
|----------|----------------|--------------------|
| VPS Path | /opt/pakistan-tax-ai | /opt/auditwise |
| DB Container | pakistan-tax-ai-db | (separate) |
| App Container | pakistan-tax-ai-app | (separate) |
| Nginx Container | pakistan-tax-ai-nginx | (separate) |
| Docker Network | pakistan_tax_ai_network | (separate) |
| Volumes | pakistan_tax_ai_* | (separate) |
| Nginx Port | 4080 (internal) | (different) |
| Domain | tax.auditwise.tech | auditwise.tech |
| SSL | Separate cert | Separate cert |
| Env File | /opt/pakistan-tax-ai/.env.production | (separate) |
| Backups | /opt/pakistan-tax-ai/backups/ | (separate) |

---

## Git Branch Strategy

```
feature/<name>  →  dev  →  main  →  VPS deploy
     ↑               ↑        ↑
  workspace     integration  production
```

- Never deploy from feature branches
- Never deploy from dev
- Only main triggers VPS deployment
- GitHub Actions auto-deploys on push to main

---

## DevOps Commands

All commands run from project root:

```bash
# Push code to GitHub
bash devops/control.sh push "your commit message"

# Full deploy to VPS (build + restart)
bash devops/control.sh deploy

# Quick deploy (pull + recreate, no rebuild)
bash devops/control.sh deploy-quick

# Check system health
bash devops/control.sh health

# Container status
bash devops/control.sh status

# View logs (default: app, 100 lines)
bash devops/control.sh logs app 200
bash devops/control.sh logs nginx 50
bash devops/control.sh logs db 100

# Restart service
bash devops/control.sh restart app
bash devops/control.sh restart nginx

# Rebuild service
bash devops/control.sh rebuild app

# Backup database
bash devops/control.sh backup

# Rollback to previous commit
bash devops/control.sh rollback

# Run remote SSH command
bash devops/control.sh ssh "docker ps"

# Initial VPS setup
bash devops/control.sh setup-vps

# Setup SSL certificate
bash devops/control.sh setup-ssl
```

---

## Development Commands

```bash
# Start all services (Replit dev)
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/tax-engine run dev

# Database
pnpm --filter @workspace/db run push    # Push schema
pnpm --filter @workspace/scripts run seed  # Seed data

# Build
pnpm --filter @workspace/api-server run build
pnpm --filter @workspace/tax-engine run build

# Type check
pnpm run typecheck
```

---

## Environment Variables

### Development (Replit)
| Variable         | Required | Description                        |
|-----------------|----------|------------------------------------|
| `DATABASE_URL`  | Yes      | PostgreSQL connection string        |
| `JWT_SECRET`    | Yes      | Secret for JWT signing             |
| `PORT`          | Yes      | Port for each service ($PORT)      |
| `AI_PROVIDER`   | No       | `openai` (default) or `gemini`     |
| `OPENAI_API_KEY`| No       | OpenAI key for AI generation       |
| `UPLOAD_DIR`    | No       | File upload directory              |
| `VAULT_DIR`     | No       | Vault storage directory            |

### Production (VPS — /opt/pakistan-tax-ai/.env.production)
| Variable | Required | Description |
|----------|----------|-------------|
| `DB_NAME` | Yes | Database name (pakistan_tax_ai) |
| `DB_USER` | Yes | Database user |
| `DB_PASSWORD` | Yes | Database password |
| `JWT_SECRET` | Yes | JWT signing secret (64+ chars) |
| `SESSION_SECRET` | Yes | Session secret |
| `ENCRYPTION_MASTER_KEY` | Yes | 32-byte hex encryption key |
| `NGINX_PORT` | No | Host port for nginx (default: 4080) |
| `VPS_HOST` | DevOps | VPS hostname/IP (for scripts only) |
| `VPS_USER` | DevOps | VPS SSH user (for scripts only) |
| `APP_PATH` | DevOps | /opt/pakistan-tax-ai |

### GitHub Actions Secrets (for auto-deploy)
| Secret | Description |
|--------|-------------|
| `VPS_HOST` | VPS IP address |
| `VPS_USER` | SSH username (root) |
| `VPS_SSH_KEY` | Private SSH key for VPS access |

---

## Deployment — First-Time VPS Setup

### Prerequisites
- Hostinger VPS with Ubuntu + Docker installed
- DNS A record: `tax.auditwise.tech` → VPS IP
- SSH access to VPS

### Step-by-Step

```bash
# 1. Generate SSH key (local/Replit)
bash devops/setup-ssh.sh

# 2. Copy public key to VPS
ssh-copy-id -i ~/.ssh/pakistan_tax_ai_vps root@YOUR_VPS_IP

# 3. Setup VPS directory structure
bash devops/control.sh setup-vps

# 4. Copy and configure env file on VPS
scp .env.example root@YOUR_VPS_IP:/opt/pakistan-tax-ai/.env.production
ssh root@YOUR_VPS_IP "nano /opt/pakistan-tax-ai/.env.production"

# 5. Deploy
bash devops/control.sh deploy

# 6. Setup SSL
bash devops/control.sh setup-ssl

# 7. Verify
bash devops/control.sh health
curl https://tax.auditwise.tech/health
```

### GitHub Actions Auto-Deploy
1. Go to GitHub repo → Settings → Secrets → Actions
2. Add: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`
3. Push to `main` → auto-deploys to VPS

---

## Health Endpoint

`GET /api/healthz` returns:
```json
{
  "status": "ok",
  "timestamp": "2026-03-22T...",
  "services": { "db": "ok", "redis": "not_configured" }
}
```

External health check: `https://tax.auditwise.tech/health`
