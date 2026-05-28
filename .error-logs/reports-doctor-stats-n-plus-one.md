# Error: Doctor Stats N+1 Query Pattern

## Flaw (Code)
Report generation queried multiple appointment and queue counts inside a loop for each doctor.

## Why It Fails
- Performs many database round-trips as doctor count grows.
- Runs mostly sequentially, increasing response latency.
- Includes artificial delay, making report generation slower.

## Solution (Design)
- Fetch doctors once.
- Fetch appointment aggregates once using `groupBy`.
- Fetch queue aggregates once using `groupBy`.
- Build final report in memory from aggregate maps.

## What This Fix Does
- Removes per-doctor query loop pattern.
- Reduces total query count to a small fixed number.
- Keeps the same response shape expected by frontend (`success`, `timeTakenMs`, `data`).
