# Appointments Route Fix Log

## 1. Appointment Slot Collision (Major)

### Issue

Duplicate bookings for the same doctor and slot could occur under concurrent requests.

### Solution Reference

This major issue is documented separately in:

`/.error-logs/appointment-slot-collision.md`

That log contains the database-level uniqueness design and conflict-handling approach.

---

## 2. N+1 Query in Appointment Listing

### Issue

Appointment listing fetched appointments first and then queried patient and doctor data inside a loop.

### Fix

Replaced looped per-row queries with Prisma `include` and `select` in a single query.

---

## 3. Error Detail Leakage

### Issue

Error responses exposed internal error messages with `details: error.message`.

### Fix

Replaced with generic API error messages and logged details on the server.

---

## 4. Missing Role Authorization

### Issue

Routes used authentication but did not enforce role-based access.

### Fix

- `GET /api/appointments` now allows: `DOCTOR`, `RECEPTIONIST`, `ADMIN`
- `POST /api/appointments` now allows: `RECEPTIONIST`, `ADMIN`
- `PATCH /api/appointments/:id` now allows: `DOCTOR`, `ADMIN`

---

## 5. Missing Booking Input Validation

### Issue

Booking route did not validate invalid dates or missing related entities.

### Fix

- Added invalid-date validation
- Added patient existence validation
- Added doctor existence validation
- Added past-date validation

---

## 6. Missing PATCH Validation

### Issue

PATCH accepted any status value and did not return clear not-found behavior.

### Fix

- Added status whitelist: `PENDING`, `COMPLETED`, `CANCELLED`
- Added not-found handling (`P2025`) with `404`
