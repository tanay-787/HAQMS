# Queue token race condition

## Flaw (Code)
```js
// reads max then creates — race can cause duplicate tokenNumber
const max = await prisma.queueToken.aggregate({ where: { doctorId, createdAt: { gte: today } }, _max: { tokenNumber: true } });
const next = (max._max.tokenNumber || 0) + 1;
await new Promise(r => setTimeout(r, 350)); // artificial delay widening race window
await prisma.queueToken.create({ data: { tokenNumber: next, patientId, doctorId, status: 'WAITING' } });
```

## Why It Fails
- Two concurrent requests can read the same max and insert identical tokenNumber → duplicate tokens for same doctor/day.
- Aggregation + separate create is not atomic; network/processing delays widen the race window.

## Solution (Design)
```prisma
model QueueToken {
  id          String   @id @default(uuid())
  tokenNumber Int
  tokenDate   DateTime
  doctorId    String
  patientId   String
  // ... other fields ...

  @@unique([doctorId, tokenDate, tokenNumber])
}
```
```js
// allocate token with retry-on-unique-conflict
const tokenDate = new Date(); tokenDate.setHours(0,0,0,0);
const maxRetries = 5;
for (let i=0;i<maxRetries;i++){
  const maxRes = await prisma.queueToken.aggregate({ where: { doctorId, tokenDate }, _max: { tokenNumber: true }});
  const next = (maxRes._max.tokenNumber || 0) + 1;
  try {
    const token = await prisma.queueToken.create({ data: { tokenNumber: next, tokenDate, patientId, doctorId, status: 'WAITING' } });
    return res.status(201).json({ token });
  } catch (err) {
    if (err.code === 'P2002') { await new Promise(r=>setTimeout(r, 50 + Math.random()*150)); continue; }
    throw err;
  }
}
res.status(500).json({ error: 'Failed to allocate token' });
```

## What This Fix Does
- Ensures token numbers are unique per doctor per day at the DB level.
- Handles concurrent insert races by retrying on unique-constraint conflicts.