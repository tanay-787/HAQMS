# Auth Middleware Fix Log

## 1. Legacy Admin Authorization Bypass

### Severity

Critical

### Issue

Admin-only middleware does not perform role verification.

### Before

```js
const authorizeAdminOnlyLegacy = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  next();
};
```

### Impact

Any authenticated user can access admin-only endpoints.

Examples:

* Receptionist deleting doctors
* Receptionist deleting patients
* Receptionist managing admins

### Fix

```js
const authorizeAdminOnlyLegacy = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      error: 'Access denied. Admin only.',
    });
  }

  next();
};
```

### Recommended Improvement

Remove this middleware entirely and use:

```js
authorize('ADMIN')
```

for all admin routes.

---

## 2. Error Response Format Inconsistency

### Issue

Middleware responses do not match the standardized API response structure used in auth routes.

### Before

```js
{
  error: 'Invalid token.'
}
```

### Fix

```js
{
  success: false,
  error: 'Invalid token.'
}
```

Apply to:

* authenticate()
* authorize()
* authorizeAdminOnlyLegacy()

---

## 3. Verbose Authorization Error Messages (Optional)

### Issue

Current response reveals required roles.

### Before

```js
{
  error: `Forbidden. Requires role: ${roles.join(' or ')}`
}
```

### Fix

```js
{
  success: false,
  error: 'Forbidden'
}
```

### Reason

Avoids exposing permission structure to clients.

---

## Summary

### Security Fixes

* Restored admin role verification
* Prevented privilege escalation through legacy middleware

### API Improvements

* Standardized error response format
* Optional reduction of authorization detail leakage

### No Changes Required

* JWT verification logic
* JWT expiration enforcement
* Bearer token extraction
* Request user attachment (`req.user`)
* Generic role-based authorization middleware (`authorize`)
