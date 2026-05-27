# HAQMS Codebase Guide

This guide explains how the repository is organized and how data flows through it, based on the current implementation.

## Repository Map

| Path | Purpose |
| --- | --- |
| `setup.sh` | One-shot bootstrap script that installs root/backend/frontend dependencies and creates `backend/.env` from `.env.example` if missing. |
| `docker-compose.yml` | Optional PostgreSQL container (`postgres:15-alpine`) on port `5432`. |
| `package.json` (root) | Workspace scripts to install packages, start DB helper, run backend+frontend together. |
| `backend/` | Express API + Prisma schema/seed. |
| `frontend/` | Next.js App Router client UI. |

## Runtime Architecture

1. Frontend sends HTTP requests to `http://localhost:5000/api` (hardcoded in `AuthContext` and queue page).
2. Express mounts route modules under `/api/auth`, `/api/patients`, `/api/doctors`, `/api/appointments`, `/api/queue`, `/api/reports`.
3. Route handlers use Prisma Client to read/write PostgreSQL.
4. JWT auth middleware reads bearer token and attaches decoded user to `req.user`.

## Authentication Model

- Login endpoint returns `{ status, data: { token, user } }`.
- Token is stored in browser `localStorage` (`haqms_token`, `haqms_user`).
- Authenticated requests send `Authorization: Bearer <token>`.

## Domain Model (High Level)

- **User**: staff account (ADMIN / DOCTOR / RECEPTIONIST).
- **Doctor**: physician profile, optionally linked to a `User`.
- **Patient**: person receiving care.
- **Appointment**: patient-doctor booking at a date/time with status.
- **QueueToken**: token issued for waiting/calling flow, tied to doctor and patient.

## Main User Journeys Implemented

1. **Login** (`/login`) -> token + user saved -> redirected to `/dashboard`.
2. **Reception/Admin patient operations**: search/register/delete/check-in/book.
3. **Doctor operations**: view appointments, move queue statuses, mark appointment complete, open patient history panel.
4. **Public queue board** (`/queue`): grouped doctor boards showing calling + waiting tokens.
5. **Admin reporting**: run doctor-stats report and physician search.

## Important Note on Existing Comments

Many files intentionally contain inline comments describing security/performance/concurrency hotspots for the internship exercise. This guide captures behavior and structure as currently implemented.
