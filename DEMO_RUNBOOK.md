# Campus Duo Demo Runbook

## Local startup

1. Start PostgreSQL on `localhost:5432`.
2. From the repository root, validate and apply migrations with the repository wrapper:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\database\scripts\Invoke-CampusDuoFlyway.ps1 `
     -Action validate -FlywayPath C:\path\to\flyway.cmd
   powershell -NoProfile -ExecutionPolicy Bypass -File .\database\scripts\Invoke-CampusDuoFlyway.ps1 `
     -Action migrate -ConfirmMigrate -FlywayPath C:\path\to\flyway.cmd
   ```

   The configured target is the local `campus_duo_dev` database. Do not use
   `clean`, `repair`, or production credentials.
3. Start the backend:

   ```powershell
   npm --prefix backend run dev
   ```

4. Start the frontend in a second terminal:

   ```powershell
   npm --prefix frontend run dev
   ```

5. Open `http://localhost:3000`. Confirm `http://localhost:4000/api/health`
   reports `UP` and `CONNECTED`.

## Development fixtures

Apply synthetic fixtures only to `campus_duo_dev` as the migration role:

```powershell
$env:PGPASSWORD = '<local migrator password>'
psql -X -v ON_ERROR_STOP=1 -h localhost -p 5432 -U campus_duo_migrator `
  -d campus_duo_dev -f database\seeds\01_reference_seed.sql
psql -X -v ON_ERROR_STOP=1 -h localhost -p 5432 -U campus_duo_migrator `
  -d campus_duo_dev -f database\seeds\02_development_seed.sql
Remove-Item Env:PGPASSWORD
```

For a clean presentation state, use a disposable local database restore or
the approved development fixture reset procedure. Never run reset or seed
commands against production.

The verified local smoke run used two development student accounts and one
administrator account created through the development-only authentication
setup. Passwords are intentionally not recorded here.

## Timed scenarios

### 1. Normal transaction (1.5 minutes)

1. Sign in as Student A and Student B in separate browser sessions.
2. Open Study Discovery, select the shared course, and show the candidate.
3. Like each other from the two sessions.
4. Open Connections and show the same persistent connection in both sessions.
5. Open Booking, select the connection, a future table-slot, and confirm.
6. Refresh both sessions and show the booking remains visible.

Expected result: one confirmed two-person table-slot booking is visible to
both participants.

### 2. Bounded AI workflow (2 minutes)

1. Submit a study recommendation request with a course filter.
2. Show candidate identities, deterministic compatibility score, grounded
   reasons, query ID, and provider/fallback status.
3. If Ollama is configured, show the model-backed result.
4. Stop or disable the local provider and repeat the request.

Expected result: the UI explicitly identifies deterministic fallback; no
booking or profile mutation occurs.

### 3. Concurrency and allocation (2.5 minutes)

1. Prepare two independent mutual connections and one available table-slot.
2. Obtain bearer tokens through the normal login flow and keep them only in
   terminal variables.
3. Run `.\scripts\Invoke-ConcurrentBookingDemo.ps1` with the slot, table,
   location, companion IDs, and the two tokens.
4. Show the real `201` success and `409` conflict responses.
5. Refresh availability or administrator bookings and show exactly one
   confirmed reservation with two participants.

Do not run a load test; this is a single controlled contention demonstration.
The verified local rehearsal produced one `201`, one `409`, and one confirmed
booking. The helper uses separate client operation IDs and has no credentials
or tokens in the repository.

### 3a. Inventory lifecycle (administrator preparation)

1. In Administration → Tables, create a development-only location with one
   table and a future slot.
2. Confirm the slot appears to students and can be booked.
3. Deactivate the location. New availability excludes the slot and the
   future slot becomes maintenance-locked; existing confirmed bookings would
   prevent deactivation rather than being silently cancelled.
4. Re-enable the location, table, and slot using their status controls, then
   confirm availability returns.
5. Show the corresponding administrator audit events.

This lifecycle was verified locally. Re-enabling all three inventory levels is
required because location deactivation intentionally cascades to tables and
future slots.

### 4. Failure recovery (1.5 minutes)

1. Disable the configured model provider locally.
2. Submit the same recommendation request.
3. Confirm the useful deterministic fallback and visible fallback reason.
4. Restore the provider and retry.

### 5. Unauthorized access (1 minute)

1. Call an admin endpoint with no token: expect `401`.
2. Call an admin endpoint with a student token: expect `403`.
3. Log out and reuse the old bearer token: expect `401`.

### 6. Traceability (1.5 minutes)

Show the repository migration history, implementation files, existing test
files, build/typecheck commands, and the deferred-evidence statement. Do not
claim fresh automated test or performance results in this pass.

## Recovery and cleanup

- Cancel demo bookings through the UI or the authenticated booking API.
- Restore the provider setting after the fallback demonstration.
- Log out all sessions.
- Keep synthetic accounts and records confined to `campus_duo_dev`.
- Do not print OTPs, bearer tokens, passwords, or private profile payloads.

## Verification boundaries

- Browser automation was not executed because no usable Playwright runtime was
  available in the checkout environment. Perform the browser clicks above
  manually and do not claim automated UI verification.
- Configured model-backed inference was not confirmed locally; Ollama responded
  but the application correctly rejected nonconforming multi-candidate output
  and used deterministic fallback. Do not label fallback as model inference.
- Automated tests, coverage, load tests, benchmarks, and formal reports remain
  deferred for this implementation pass.
