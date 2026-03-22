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

## Infrastructure

- `infra/Dockerfile.api` — Production Docker image for API
- `infra/Dockerfile.frontend` — Nginx-served frontend Docker image
- `infra/docker-compose.yml` — Full stack compose (postgres, api, frontend)
- `infra/nginx.conf` — Nginx with `/api/` proxy upstream + SPA fallback
- `.github/workflows/ci.yml` — Typecheck + build + Docker CI

---

## Development Commands

```bash
# Start all services
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

| Variable         | Required | Description                        |
|-----------------|----------|------------------------------------|
| `DATABASE_URL`  | Yes      | PostgreSQL connection string        |
| `JWT_SECRET`    | Yes      | Secret for JWT signing (change in prod!) |
| `PORT`          | Yes      | Port for each service ($PORT per artifact) |
| `AI_PROVIDER`   | No       | `openai` (default) or `gemini`     |
| `OPENAI_API_KEY`| No       | OpenAI key for AI generation       |
| `UPLOAD_DIR`    | No       | File upload directory (default /tmp/uploads) |
| `VAULT_DIR`     | No       | Vault storage directory (default /tmp/vault) |

---

## Deployment (Hostinger VPS)

**IMPORTANT:** GitHub is the source of truth. Never deploy directly from Replit.

1. Push to `main` branch → GitHub Actions CI runs
2. SSH to VPS: `git pull && docker compose -f infra/docker-compose.yml up -d --build`
3. Set production env vars in `.env` file on VPS (never commit)
4. Run migrations: `docker exec api node -e "require('./dist/migrate.mjs')"`
