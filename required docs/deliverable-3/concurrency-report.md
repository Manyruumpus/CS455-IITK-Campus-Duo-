# Concurrency Test Report

The real PostgreSQL booking race evidence is `evidence/backend-tests/booking-concurrency-isolated.json`. The test sends 10 concurrent booking attempts for the same final slot/resource and verifies the database constraint/transaction boundary permits one confirmed booking while competing attempts fail safely. The fixture and cleanup are isolated to the regression test database; no development or production data is used.

This is database concurrency evidence for the booking endpoint, not a performance/load result and not multi-node deployment evidence. The later full-suite rerun was blocked by missing credentials; the earlier successful isolated evidence remains the authoritative result.

