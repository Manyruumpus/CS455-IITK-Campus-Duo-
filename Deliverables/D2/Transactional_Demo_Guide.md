# Campus Duo — Core Transactional Workflow Demonstration Guide

**Milestone:** Deliverables 2 & 3 Interactive Demonstration  
**Worktree:** `C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration`  
**Target Environment:** Localhost (Backend: `http://localhost:4000`, PostgreSQL 17 on `5432`)  
**Status:** FULLY REPRODUCIBLE DEMO SCRIPT (CURL / HTTP CLIENT BACKED)  

---

## 1. Prerequisites & Demo Setup

Before running this demonstration, ensure the backend is running with development test-harness enabled:
```powershell
Set-Location "C:\Users\cavlc\OneDrive\Desktop\AI\Campus-Duo-Qwen-Integration\backend"
npm run dev
```

### Pre-Configured Demo Test Actors:
- **Student A (Alex Sharma):** `00000000-0000-0000-0000-00000000D501` (`ROLE_STUDENT`)
- **Student B (Sam Patel):** `00000000-0000-0000-0000-00000000D502` (`ROLE_STUDENT`, mutual match with Alex)
- **Student C (Jordan Lee):** `00000000-0000-0000-0000-00000000D503` (`ROLE_STUDENT`, competing student)
- **Administrator:** `00000000-0000-0000-0000-00000000D599` (`ROLE_ADMIN`)

---

## 2. Step-by-Step 10-Stage Demonstration Script

### Step 1: Health & Database Connectivity Verification
Verify that the service is running and connected to PostgreSQL under restricted credentials:
```bash
curl -X GET http://localhost:4000/api/health
```
**Expected Response:** `HTTP 200 OK`, `status: "UP"`, `database: "CONNECTED"`, `databaseUser: "campus_duo_app"`.

---

### Step 2: Student Authentication & Session Acquisition
Demonstrate institutional OTP challenge and verification flow:
```bash
# 1. Dispatch OTP challenge to verified @iitk.ac.in address
curl -X POST http://localhost:4000/api/auth/login/challenge \
  -H "Content-Type: application/json" \
  -d '{"email": "alex.sharma@iitk.ac.in"}'

# 2. Complete login with challenge OTP (In dev, mock code 123456 or dev transport OTP)
# Or obtain session token via developer test harness:
export ALEX_TOKEN="Bearer <SESSION_TOKEN_OR_USE_TEST_ACTOR_HEADER>"
```

---

### Step 3: Browse Available Study Locations
Query physical study room spaces across the campus:
```bash
curl -X GET http://localhost:4000/api/booking/locations \
  -H "X-Campus-Duo-Test-Actor: 00000000-0000-0000-0000-00000000D501"
```
**Expected Response:** `HTTP 200 OK` listing PK Kelkar Library 2F, Hall 3 Common Room, CC-101 Study Lab.

---

### Step 4: Query Real-Time Table Availability
Query available tables and unreserved time slots for tomorrow's date:
```bash
curl -X GET "http://localhost:4000/api/booking/availability?date=2026-11-14" \
  -H "X-Campus-Duo-Test-Actor: 00000000-0000-0000-0000-00000000D501"
```
**Expected Response:** `HTTP 200 OK` showing Table A1 (`00000000-0000-0000-0000-00000000D521`) available for `14:00-16:00`.

---

### Step 5: Atomically Create Study Table Reservation (UC-01 & FR-07)
Student A creates a reservation with mutual study match Student B:
```bash
curl -X POST http://localhost:4000/api/booking \
  -H "Content-Type: application/json" \
  -H "X-Campus-Duo-Test-Actor: 00000000-0000-0000-0000-00000000D501" \
  -d '{
    "slotDate": "2026-11-14",
    "timeSlot": "14:00-16:00",
    "resourceId": "00000000-0000-0000-0000-00000000D521",
    "companionUserId": "00000000-0000-0000-0000-00000000D502",
    "idempotencyKey": "demo-trans-uuid-001"
  }'
```
**Expected Response:** `HTTP 201 Created`, returning booking ID (`demo-bk-id`), `status: "CONFIRMED"`.

---

### Step 6: Verify Booking Persistence & Participant Authorization
Retrieve booking details using Student A's credentials:
```bash
curl -X GET http://localhost:4000/api/booking/demo-bk-id \
  -H "X-Campus-Duo-Test-Actor: 00000000-0000-0000-0000-00000000D501"
```
**Expected Response:** `HTTP 200 OK` with full reservation metadata.

---

### Step 7: Attempt Conflicting Booking & Verify 409 Conflict Prevention
Simulate Student C attempting to claim the exact same table and time slot:
```bash
curl -X POST http://localhost:4000/api/booking \
  -H "Content-Type: application/json" \
  -H "X-Campus-Duo-Test-Actor: 00000000-0000-0000-0000-00000000D503" \
  -d '{
    "slotDate": "2026-11-14",
    "timeSlot": "14:00-16:00",
    "resourceId": "00000000-0000-0000-0000-00000000D521",
    "companionUserId": "00000000-0000-0000-0000-00000000D502",
    "idempotencyKey": "demo-trans-uuid-002"
  }'
```
**Expected Response:** `HTTP 409 Conflict`, error code `"CONFLICT"`, message `"Selected study space slot is already reserved"`.  
**Database Guarantee:** PostgreSQL partial unique index `booking_confirmed_resource_uk` strictly prevents duplicate insertion.

---

### Step 8: View Student Booking History
Query all active and past bookings for Student A:
```bash
curl -X GET http://localhost:4000/api/booking \
  -H "X-Campus-Duo-Test-Actor: 00000000-0000-0000-0000-00000000D501"
```
**Expected Response:** `HTTP 200 OK` returning an array containing `demo-bk-id`.

---

### Step 9: Governed AI Recommendation Agent & Fallback Demonstration
Request grounded study partner recommendations for CS455:
```bash
curl -X POST http://localhost:4000/api/agent/recommend \
  -H "Content-Type: application/json" \
  -H "X-Campus-Duo-Test-Actor: 00000000-0000-0000-0000-00000000D501" \
  -d '{
    "courseCode": "CS455",
    "prompt": "Find a partner for database indexing and concurrency revision",
    "limit": 3
  }'
```
**Expected Response:** `HTTP 200 OK` returning ranked matches with deterministic scores (e.g. 92/100), grounded reasons (`Shared courses: CS455`, `Overlapping study availability`), status `"FALLBACK"`, and zero database mutations.

---

### Step 10: Role-Based Access Control (RBAC) Enforcement
Demonstrate that a student cannot access administrative endpoints:
```bash
# Student attempt -> 403 Forbidden
curl -X GET http://localhost:4000/api/admin/summary \
  -H "X-Campus-Duo-Test-Actor: 00000000-0000-0000-0000-00000000D501"

# Admin attempt -> 200 OK
curl -X GET http://localhost:4000/api/admin/summary \
  -H "X-Campus-Duo-Test-Actor: 00000000-0000-0000-0000-00000000D599"
```
**Expected Responses:** Student receives `HTTP 403 Forbidden` (`FORBIDDEN`); Administrator receives `HTTP 200 OK` with system counts.
