# Campus Duo — API Documentation

**Version:** 1.0.0 (Deliverables 2 & 3 Baseline)  
**Base URL:** `http://localhost:4000/api`  
**Authentication Scheme:** `Authorization: Bearer <sessionToken>`  
**Development Bypass:** `X-Campus-Duo-Test-Actor: <UUID>` (Active ONLY when `NODE_ENV=development` and `ALLOW_TEST_HARNESS_AUTH=true`)

---

## 1. Global Conventions & Error Schemas

### Standard Success Response
```json
{
  "status": "success",
  "data": { ... }
}
```

### Standard Error Response (RFC 7807 aligned)
```json
{
  "error": {
    "code": "VALIDATION_ERROR | UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | CONFLICT | SERVICE_UNAVAILABLE",
    "message": "Human-readable description",
    "requestId": "req-xxxx-xxxx"
  }
}
```

---

## 2. Authentication & Account Lifecycle (`/api/auth`)

### 2.1 Send Registration OTP Challenge
`POST /api/auth/register/challenge`
- **Description:** Sends a 6-digit OTP to a valid IIT Kanpur email address.
- **Request Body:**
  ```json
  { "email": "student@iitk.ac.in" }
  ```
- **Responses:**
  - `200 OK`: `{"status": "success", "data": {"challengeId": "uuid", "expiresInSeconds": 600}}`
  - `400 VALIDATION_ERROR`: Non-IITK email domain.
  - `429 RATE_LIMITED`: Resend requested within 60s cooldown.

### 2.2 Verify Registration OTP & Complete Account Setup
`POST /api/auth/register/verify`
- **Request Body:**
  ```json
  {
    "challengeId": "uuid",
    "otp": "123456",
    "password": "StrongPassword123!",
    "displayName": "Alex Sharma",
    "department": "CSE",
    "year": 3
  }
  ```
- **Responses:**
  - `201 Created`: Returns user object, session token, and `isFirstLogin: true`.

### 2.3 Send Login OTP Challenge
`POST /api/auth/login/challenge`
- **Request Body:**
  ```json
  { "email": "student@iitk.ac.in" }
  ```

### 2.4 Verify Login OTP
`POST /api/auth/login/verify`
- **Request Body:**
  ```json
  { "challengeId": "uuid", "otp": "123456" }
  ```
- **Responses:**
  - `200 OK`: Returns authenticated session token.

### 2.5 Current User Session Profile
`GET /api/auth/me`
- **Headers:** `Authorization: Bearer <sessionToken>`
- **Response:**
  ```json
  {
    "status": "success",
    "data": {
      "userId": "uuid",
      "email": "student@iitk.ac.in",
      "displayName": "Alex Sharma",
      "role": "ROLE_STUDENT",
      "verificationStatus": "VERIFIED"
    }
  }
  ```

---

## 3. Study Space & Resource Discovery

### 3.1 List Active Booking Locations
`GET /api/booking/locations`
- **Authentication:** Student or Admin
- **Response:**
  ```json
  {
    "status": "success",
    "data": [
      {
        "locationId": "00000000-0000-0000-0000-00000000D511",
        "name": "PK Kelkar Library — 2nd Floor Reading Room",
        "code": "LIBRARY_2F",
        "description": "Quiet study tables",
        "operatingHours": "08:00 - 00:00",
        "tableCount": 4
      }
    ]
  }
  ```

### 3.2 Query Table Availability by Date
`GET /api/booking/availability?date=YYYY-MM-DD`
- **Query Params:** `date` (ISO date, e.g. `2026-11-14`), optional `locationId`.
- **Response:** Returns list of available 2-person tables and unreserved time slots (`08:00-10:00`, `10:00-12:00`, etc.).

---

## 4. Transactional Booking Lifecycle (`/api/booking`)

### 4.1 Create Atomic Booking (UC-01 & FR-07)
`POST /api/booking`
- **Authentication:** `ROLE_STUDENT`
- **Request Body:**
  ```json
  {
    "slotDate": "2026-11-14",
    "timeSlot": "14:00-16:00",
    "resourceId": "00000000-0000-0000-0000-00000000D521",
    "companionUserId": "00000000-0000-0000-0000-00000000D502",
    "idempotencyKey": "unique-client-req-uuid"
  }
  ```
- **Responses:**
  - `201 Created`:
    ```json
    {
      "status": "success",
      "data": {
        "bookingId": "uuid",
        "status": "CONFIRMED",
        "slotDate": "2026-11-14",
        "timeSlot": "14:00-16:00",
        "resourceName": "Table A1",
        "companionName": "Sam Patel"
      }
    }
    ```
  - `409 CONFLICT`: Slot already reserved by a competing concurrent transaction.
  - `400 VALIDATION_ERROR`: Past date, duplicate participant, or missing mutual match.

### 4.2 Retrieve Participant Booking
`GET /api/booking/:bookingId`
- **Authorization:** Only the creator student, companion student, or an admin can access. Non-participants receive `403 Forbidden`.

### 4.3 Student Booking History
`GET /api/booking`
- **Response:** List of all active, past, cancelled, and rescheduled bookings where the requesting student is a participant.

### 4.4 Atomic Booking Cancellation (FR-09)
`POST /api/booking/:bookingId/cancel`
- **Description:** Transitions booking to `CANCELLED`, releases partial unique index slot capacity, and records audit entry.
- **Responses:** `200 OK` or `400` if already cancelled or past date.

### 4.5 Atomic Reschedule (FR-08)
`POST /api/booking/:bookingId/reschedule`
- **Request Body:**
  ```json
  {
    "newSlotDate": "2026-11-15",
    "newTimeSlot": "16:00-18:00",
    "newResourceId": "uuid"
  }
  ```
- **Responses:** Atomically creates successor booking and marks predecessor `CANCELLED` within a single database transaction. If target slot is taken, transaction aborts cleanly with 409 Conflict and preserves existing booking intact.

---

## 5. Governed AI Recommendation Agent (`/api/agent`)

### 5.1 Request Compatibility Recommendations (FR-04, FR-10, FR-11)
`POST /api/agent/recommend`
- **Authentication:** `ROLE_STUDENT`
- **Request Body:**
  ```json
  {
    "courseCode": "CS455",
    "prompt": "Find a partner for database indexing and concurrency revision",
    "limit": 5
  }
  ```
- **Response:**
  ```json
  {
    "status": "success",
    "data": {
      "recommendations": [
        {
          "profile": {
            "userId": "uuid",
            "displayName": "Priya Singh",
            "department": "CSE",
            "year": 3
          },
          "aiMatchScore": 92,
          "aiMatchReasons": [
            "Shared courses: CS455",
            "Overlapping study availability",
            "Style: quiet focused",
            "Common study location preference"
          ],
          "explanation": "Match score: 92/100. Grounded compatibility: Shared courses: CS455; Overlapping study availability."
        }
      ],
      "suggestedAlternatives": [],
      "status": "OK | FALLBACK",
      "modelUsed": "Qwen/Qwen3-4B-Instruct-2507 | deterministic-template-v1"
    }
  }
  ```

---

## 6. System Health & Observability (`/api/health`)

### 6.1 System & Database Connectivity Health Check
`GET /api/health`
- **Authentication:** None (Public)
- **Responses:**
  - `200 OK` (Database connected):
    ```json
    {
      "status": "UP",
      "database": "CONNECTED",
      "databaseUser": "campus_duo_app",
      "databaseName": "campus_duo_dev",
      "timestamp": "2026-11-05T01:30:00.000Z"
    }
    ```
  - `503 SERVICE_UNAVAILABLE` (Database disconnected):
    ```json
    {
      "status": "DOWN",
      "database": "DISCONNECTED",
      "error": "Database connection failed",
      "timestamp": "2026-11-05T01:30:00.000Z"
    }
    ```
