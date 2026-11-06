# Deliverable 3 (D3) — Production Deployment & Operational Runbook (KAN-87) — Architectural Deployment Blueprint

**Milestone:** Deliverable 3 Deployment Engineering (KAN-87)  
**Repository:** `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration`  
**Target Architecture:** Containerized Multi-Tier Web Application (Node.js 22 + PostgreSQL 17 + Nginx)  
**Date:** November 5, 2026  
**Status:** COMPLETE — ARCHITECTURAL DEPLOYMENT BLUEPRINT & OPERATIONAL RUNBOOK  

---

## 1. System Architecture & Topology

Campus Duo is packaged as a modular monolith with three primary runtime tiers:
1. **Frontend Edge:** Static React 18 single-page application served via Nginx or Cloudflare CDN.
2. **Backend Application:** Express.js TypeScript application running on Node.js 22 (LTS).
3. **Database Tier:** PostgreSQL 17 running on Linux x64 with dedicated storage volumes for data persistence.

> [!NOTE]
> This document specifies the **Architectural Deployment Blueprint** and operational runbook for containerized production releases. When implementing continuous delivery pipelines or local Compose environments, adhere to the PostgreSQL container entrypoint mounting behavior and role bootstrap ordering detailed in Sections 2 and 4.

```
                  ┌────────────────────────────────────────┐
                  │          Client Web Browser            │
                  └──────────────────┬─────────────────────┘
                                     │ HTTPS (Port 443)
                                     ▼
                  ┌────────────────────────────────────────┐
                  │       Reverse Proxy (Nginx / ALB)      │
                  └─────────┬────────────────────┬─────────┘
                            │                    │
              Static Assets │                    │ API Reverse Proxy
             (Vite Bundle)  ▼                    ▼ (/api/*)
    ┌──────────────────────────────┐    ┌──────────────────────────────┐
    │     Nginx Web Container      │    │   Node.js 22 Application     │
    │      (Port 80 / internal)    │    │      (Port 4000)             │
    └──────────────────────────────┘    └──────────────┬───────────────┘
                                                       │
                                        PostgreSQL TCP │ Connection Pool
                                        (Port 5432)    ▼ (campus_duo_app)
                                        ┌──────────────────────────────┐
                                        │    PostgreSQL 17 Database    │
                                        │      (campus_duo_prod)       │
                                        └──────────────┬───────────────┘
                                                       │
                                                       ▼ Persistent Volume
                                               [/var/lib/postgresql/data]
```

---

## 2. Docker & Container Configuration

### 2.1 Backend Dockerfile (`backend/Dockerfile`)
```dockerfile
# Multi-stage build for minimal production image
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1
CMD ["node", "dist/src/server.js"]
```

### 2.2 Docker Compose (`docker-compose.yml`)
```yaml
version: '3.8'

services:
  database:
    image: postgres:17-alpine
    container_name: campus-duo-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: campus_duo_prod
      POSTGRES_USER: campus_duo_migrator
      POSTGRES_PASSWORD: ${DB_MIGRATOR_PASSWORD:?Set DB_MIGRATOR_PASSWORD in environment}
    volumes:
      - pgdata:/var/lib/postgresql/data
      # Note: Official PostgreSQL container runs *.sql files located directly in /docker-entrypoint-initdb.d/
      # For initial automated bootstrapping, mount a sequential initialization runner script or execute Section 4.
      - ./database/setup/01-bootstrap.psql:/docker-entrypoint-initdb.d/01-bootstrap.sql:ro
      - ./database/setup/03-runtime-roles.psql:/docker-entrypoint-initdb.d/02-runtime-roles.sql:ro
    networks:
      - internal-net
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U campus_duo_migrator -d campus_duo_prod"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: campus-duo-backend
    restart: unless-stopped
    environment:
      PORT: 4000
      NODE_ENV: production
      ALLOW_TEST_HARNESS_AUTH: "false"
      PGHOST: database
      PGPORT: 5432
      PGDATABASE: campus_duo_prod
      PGUSER: campus_duo_app
      ENABLE_LLM_INFERENCE: "false" # Set true only if HF_TOKEN is supplied
      EMAIL_TRANSPORT: "smtp"
      EMAIL_DELIVERY_REQUIRED: "true"
    env_file:
      - .env.production
    depends_on:
      database:
        condition: service_healthy
    networks:
      - internal-net
      - edge-net
    expose:
      - "4000"

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: campus-duo-frontend
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    networks:
      - edge-net

volumes:
  pgdata:

networks:
  internal-net:
    internal: true
  edge-net:
```

---

## 3. Environment Configuration & Secret Management

### Production Environment Variables (`backend/.env.production`)
```ini
# Production Server Settings
PORT=4000
NODE_ENV=production
ALLOW_TEST_HARNESS_AUTH=false

# Database Configuration (campus_duo_app non-superuser role)
PGHOST=database
PGPORT=5432
PGDATABASE=campus_duo_prod
PGUSER=campus_duo_app
PGPASSWORD=STRONG_PRODUCTION_APP_PASSWORD_HERE

# Institutional Email Delivery (IITK CC Relay)
EMAIL_TRANSPORT=smtp
EMAIL_DELIVERY_REQUIRED=true
EMAIL_FROM="Campus Duo IITK <noreply@campusduo.iitk.ac.in>"
SMTP_HOST=smtp.iitk.ac.in
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=campus_duo_relay
SMTP_PASS=STRONG_SMTP_PASSWORD_HERE

# Hugging Face Router Hosted Inference (Optional)
ENABLE_LLM_INFERENCE=false
HF_MODEL_ID=Qwen/Qwen3-4B-Instruct-2507
HF_TIMEOUT_MS=5000
# Supply secret HF token via secure environment vault:
# HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxx
```

> [!CAUTION]
> In production (`NODE_ENV=production`), `ALLOW_TEST_HARNESS_AUTH` must **never** be set to `true`. When set to false, all requests supplying developer bypass headers (`X-Campus-Duo-Test-Actor`) are unconditionally rejected with HTTP 403 Forbidden.

---

## 4. Database Setup & Migration Sequence

### 4.1 Prerequisite Database & Role Bootstrap (Executed as PostgreSQL Superuser)
Before migrations can be applied, the target database and the runtime roles (`campus_duo_app`, `campus_duo_ro`, `campus_duo_auditor`) must be provisioned. Migration `V008__runtime_access_privileges.sql` performs an explicit existence check and throws an exception (`RAISE EXCEPTION 'Required role campus_duo_app does not exist'`) if runtime roles are absent.

```bash
# Provision database and migration owner role
psql -U postgres -f database/setup/01-bootstrap.psql

# Provision runtime application and auditor roles
psql -U postgres -d campus_duo_prod -f database/setup/03-runtime-roles.psql
```

### 4.2 Sequential Migration Pipeline (Executed as `campus_duo_migrator`)
Once roles are bootstrapped, apply schema migrations sequentially using the migration owner role `campus_duo_migrator`:
```bash
# 1. Apply baseline account, session, and role structures
psql -U campus_duo_migrator -d campus_duo_prod -f database/migrations/V001__init_accounts.sql
psql -U campus_duo_migrator -d campus_duo_prod -f database/migrations/V002__study_bookings.sql
psql -U campus_duo_migrator -d campus_duo_prod -f database/migrations/V003__discovery_matching.sql
psql -U campus_duo_migrator -d campus_duo_prod -f database/migrations/V004__admin_inventory.sql
psql -U campus_duo_migrator -d campus_duo_prod -f database/migrations/V005__bookings_and_idempotency.sql
psql -U campus_duo_migrator -d campus_duo_prod -f database/migrations/V006__audit_and_outbox.sql
psql -U campus_duo_migrator -d campus_duo_prod -f database/migrations/V007__agent_views_and_functions.sql
psql -U campus_duo_migrator -d campus_duo_prod -f database/migrations/V008__runtime_access_privileges.sql
psql -U campus_duo_migrator -d campus_duo_prod -f database/migrations/V009__local_auth_and_sessions.sql

# 2. Verify runtime role grants
psql -U campus_duo_migrator -d campus_duo_prod -c "\dp campus_duo.*"
```

---

## 5. Health Check & Monitoring

### Operational Health Endpoint
```bash
curl -I http://localhost:4000/api/health
```
- Returns `HTTP 200 OK` when the API process is healthy and active connections can be acquired from `pg.Pool`.
- Returns `HTTP 503 Service Unavailable` if PostgreSQL is offline or unreachable.

### Key Monitoring Metrics:
1. **HTTP Error Rates:** Alert if 5xx errors exceed 0.5% of total traffic.
2. **Database Connection Pool Exhaustion:** Monitor `pg.Pool.waitingCount`. If queue exceeds 5 waiting clients, scale connection pool.
3. **Double-Booking Violations (409 Conflict):** Normal behavior during high contention, but a spike across all slots indicates client-side clock skew.
4. **AI Inference Fallback Rate:** Alert if `status == "FALLBACK"` exceeds 10% when `ENABLE_LLM_INFERENCE=true`.

---

## 6. Troubleshooting & Disaster Recovery

| Symptom | Probable Cause | Corrective Action |
|---|---|---|
| `GET /api/health` returns 503 | PostgreSQL service down or credentials invalid | Verify `docker ps -a`, test database connection with `psql`, inspect database logs. |
| Student registration fails with "ambiguous user_id" | Migration V009 unapplied | Verify that `V009__local_auth_and_sessions.sql` (Commit C fix) is applied. |
| Bookings fail with 403 Forbidden | Test actor header used in production | In production, authenticate via `POST /api/auth/login/verify` and supply `Authorization: Bearer <token>`. |
| Hugging Face router returns 400 or 402 | Router tier or token quota exhausted | Application automatically falls back to `TemplateLlmClient`. Verify token credits on huggingface.co. |
