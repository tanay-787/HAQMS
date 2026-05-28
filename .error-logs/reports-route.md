# Reports Route Fix Log

## 1. Doctor Stats N+1 Pattern (Major)

### Issue

`GET /api/reports/doctor-stats` used loop-based per-doctor database queries, causing major performance issues.

### Solution Reference

This major issue is documented separately in:

`/.error-logs/reports-doctor-stats-n-plus-one.md`

---

## 2. Error Detail Leakage

### Issue

Route returned internal error details in API responses.

### Fix

Replaced client-facing error response with a generic message and kept detailed error output in server logs.
