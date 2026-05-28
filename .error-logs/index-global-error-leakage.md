# Error: Global Error Leakage in index.js

## Flaw (Code)
The global error handler returned raw `err.message` and conditionally `err.stack` in API responses.

## Why It Fails
- Exposes internal backend details to clients.
- Can leak implementation paths, query internals, and debugging data.

## Solution (Design)
- Log full error details on the server.
- Return only a safe generic client response:

```json
{
  "success": false,
  "error": "Internal server error"
}
```

## What This Fix Does
- Stops sensitive error detail leakage to API clients.
- Keeps server-side logs for debugging.
