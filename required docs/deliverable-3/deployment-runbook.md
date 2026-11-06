# Deployment Runbook

## Local backend

From the repository root:

```powershell
Set-Location .\backend
npm install
npm run build
$env:NODE_ENV = 'development'
$env:ALLOW_TEST_HARNESS_AUTH = 'true'
$env:PGHOST = '127.0.0.1'
$env:PGPORT = '5432'
$env:PGDATABASE = 'campus_duo_perf_20261103'
$env:PGUSER = 'campus_duo_app'
$env:PGPASSWORD = '<enter interactively; never commit or print>'
$env:PORT = '4000'
npm start
```

The TypeScript build emits `dist/src/server.js`; `npm start` uses that built
entry point. The repository-root performance launcher uses its own
loopback-only startup wrapper and is not the normal deployment command.

The performance launcher uses the same built app and explicitly binds to `127.0.0.1:4400`; ordinary `server.ts` startup uses the configured port and should be treated as development-only unless binding is separately controlled.

## Database

Use only `campus_duo_perf_20261103` for the performance procedure. Run the guarded initialized resume command from the performance report with interactive migrator/admin/application credentials. The script resolves migrations from its own path, preserves Flyway history/checksums, verifies V001–V008 success and required tables, and performs least-privilege app checks. Never use `clean`, `repair`, `baseline`, drop/recreate, or development database configuration for this target.

## Frontend

```powershell
Set-Location .\frontend
npm install
npm run dev
```

Default development mode is a deterministic mock/demo showcase. Production mode intentionally exposes unavailable adapters until real authentication/backend integration is implemented. No real credentials belong in frontend environment files.

## Health, rollback and secrets

Verify `/api/health` only after the app is configured for the intended local database. Store secrets in the process environment or an approved local secret mechanism; do not put them in command arguments, evidence, logs or source. Roll back application code by the reviewed Git workflow and database changes only through forward Flyway migrations; do not edit or delete migration history. Recovery testing is verified only for the disposable loopback cluster recorded
in `failure-recovery-report.md`; hosted or production recovery is not claimed.

