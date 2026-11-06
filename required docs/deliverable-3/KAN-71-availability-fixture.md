# KAN-71 Availability Fixture

`backend/tests/availability.test.ts` now creates and removes its own availability
fixture instead of relying on the development seed's mutable slot dates. The
fixture owns one location, one table, three slots on `2026-11-14`, one confirmed
booking with Alex and Sam as participants, one cancelled booking, and one
unbooked slot. Availability requests are restricted to that fixture location.
The location and table are explicitly active, the table capacity is explicitly
2, and all slots are explicitly active and `AVAILABLE`. The confirmed booking
explicitly uses `CONFIRMED` and `NOT_REQUIRED` partner approval.

The helper reuses the development seed's Alex/Sam accounts and mutual STUDY
connection only because the booking schema requires eligible actors. Before
writing, it explicitly verifies both accounts are active, verified students,
both have active STUDY consent, and the specified connection is mutual,
connected, and in STUDY mode.

Before fixture writes, both the restricted migrator connection and the
application pool must report exactly `campus_duo_test`. A configured
`DATABASE_URL` is rejected because the application would use it while the
migrator helper does not. All fixture writes and cleanup require
`CAMPUS_DUO_MIGRATOR_PASSWORD`. Cleanup uses only the explicit fixture IDs,
removes dependent booking records before slots/resources, and does not use
prefixes or broad deletion. Database setup and test execution remain a
separate review checkpoint.
