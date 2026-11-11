# Campus Duo Release Startup

This is the presentation startup path for the local development release. It
uses PostgreSQL on `localhost:5432`, the `campus_duo_dev` database, Flyway
migrations V001 through V013, the backend on port 4000, and the frontend on
port 3000.

## 1. Prerequisites

- PostgreSQL running locally.
- Node.js and npm.
- The repository Flyway wrapper and an approved local Flyway CLI path.
- Ollama is optional. The deterministic recommendation fallback remains
  available when the configured provider is unavailable.

Do not put passwords, OTPs, bearer tokens, or provider credentials in this
file or in tracked files.

## 2. Install and migrate

```powershell
npm install

powershell -NoProfile -ExecutionPolicy Bypass -File .\database\scripts\Invoke-CampusDuoFlyway.ps1 `
  -Action validate -FlywayPath C:\path\to\flyway.cmd

powershell -NoProfile -ExecutionPolicy Bypass -File .\database\scripts\Invoke-CampusDuoFlyway.ps1 `
  -Action migrate -ConfirmMigrate -FlywayPath C:\path\to\flyway.cmd
```

The configured database is local only. Do not run `clean`, `repair`, or these
commands against a production database. The application connects as
`campus_duo_app`; Flyway applies migrations as the local migration owner.

For disposable presentation fixtures, use the guarded seed scripts only with
`campus_duo_dev` and the approved local migration credentials:

```powershell
psql -X -v ON_ERROR_STOP=1 -h localhost -p 5432 -U campus_duo_migrator `
  -d campus_duo_dev -f .\database\seeds\01_reference_seed.sql
psql -X -v ON_ERROR_STOP=1 -h localhost -p 5432 -U campus_duo_migrator `
  -d campus_duo_dev -f .\database\seeds\02_development_seed.sql
```

## 3. Start services

In separate terminals:

```powershell
npm --prefix backend run dev
npm --prefix frontend run dev
```

Open `http://localhost:3000` and confirm:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
```

The frontend must use the backend URL configured in its local environment
file. Backend provider settings are configured through `backend/.env`; the
checked-in `.env.example` contains names and safe example values only.

## 4. AI provider

The optional local provider is Ollama at `http://localhost:11434`. Configure an
installed model in the local backend environment. The application labels
provider-backed responses separately from deterministic fallback responses.
If Ollama is stopped, recommendations should continue through the grounded
deterministic fallback and expose the fallback state in the response/UI.

## 5. Presentation fixtures and reset

Use synthetic accounts confined to `campus_duo_dev`. Prepare two reciprocal
student connections, one administrator, a future available slot, and a
moderation report through the supported UI/API flows. Cancel demo bookings and
restore disabled inventory after rehearsal. If a clean state is required,
restore the disposable local database or use the approved guarded development
fixture reset procedure; never reset production data.

For the focused concurrency rehearsal, use the helper without printing tokens:

```powershell
$env:CAMPUS_DUO_DEMO_DATE = 'YYYY-MM-DD'
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\Invoke-ConcurrentBookingDemo.ps1 `
  -SlotId '<slot-id>' -TableId '<table-id>' -LocationId '<location-id>' `
  -StudentAToken $studentAToken -StudentBToken $studentBToken `
  -StudentACompanionId '<student-b-id>' -StudentBCompanionId '<student-a-id>'
Remove-Item Env:CAMPUS_DUO_DEMO_DATE -ErrorAction SilentlyContinue
```

Use two distinct authenticated student sessions and separate operation IDs.
Expected result is one `201` and one `409`, with exactly one confirmed
reservation afterward. The helper is a single contention rehearsal, not a
load test.

## 6. Troubleshooting

- `401`: restore the session through the login flow; do not use development
  actor headers or browser-selected roles.
- `403`: confirm the account is authorized for the requested administrator
  operation.
- `409` during booking: refresh availability; the slot may already be held.
- No future slot after location re-enable: re-enable the table and slot too;
  location deactivation intentionally locks all future inventory.
- AI fallback: verify the provider URL/model and retry without exposing
  provider credentials.
- SQL privilege errors: validate that V012 and V013 are applied and that the
  backend is using `campus_duo_app`.

Automated tests, coverage, load testing, benchmarking, and formal submission
evidence are intentionally deferred for this release pass.
