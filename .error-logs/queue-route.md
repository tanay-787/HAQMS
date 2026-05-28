# Queue Route Fix Log

## 1. Token Allocation Race Condition

### Issue

Concurrent check-ins could allocate the same token number for the same doctor/day.

### Solution Reference

This issue is already documented and fixed in:

`/.error-logs/queue-token-race-condition.md`

That log contains the race condition explanation, DB uniqueness strategy, and retry approach.

---

## 2. Error Detail Leakage

### Issue

Queue routes returned internal error details in API responses.

### Fix

Replaced error responses with safe generic messages and kept detailed logs on the server.

---

## 3. Missing Role Authorization

### Issue

Queue endpoints relied only on authentication and lacked role-based restrictions.

### Fix

- `GET /api/queue` now allows: `DOCTOR`, `RECEPTIONIST`, `ADMIN`
- `POST /api/queue/checkin` now allows: `RECEPTIONIST`, `ADMIN`
- `PATCH /api/queue/:id` now allows: `DOCTOR`, `ADMIN`

---

## 4. Missing Entity Validation in Check-in

### Issue

Check-in could proceed without verifying patient, doctor, and appointment validity.

### Fix

Added checks to ensure:

- patient exists
- doctor exists
- optional appointment exists
- appointment belongs to the same patient and doctor when provided

---

## 5. Missing Status Validation and Transition Rules

### Issue

Queue status update accepted any value and allowed invalid state jumps.

### Fix

- Added allowed statuses: `WAITING`, `CALLING`, `COMPLETED`, `SKIPPED`
- Added transition guards:
  - `WAITING -> CALLING | SKIPPED`
  - `CALLING -> COMPLETED | SKIPPED`
  - `COMPLETED` and `SKIPPED` are terminal states

---

## 6. Active Queue Scope Mismatch

### Issue

`GET /api/queue` was intended for active queue monitoring but could return broader data by default.

### Fix

Default behavior now filters to:

- current day tokens (`tokenDate` day scope)
- active statuses (`WAITING`, `CALLING`) unless an explicit status filter is passed
