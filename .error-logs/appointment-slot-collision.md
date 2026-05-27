# Error: Appointment Slot Collision

## Flaw (Code)
```prisma
model Appointment {
  id              String   @id @default(uuid())
  doctorId        String
  appointmentDate DateTime
  status          AppointmentStatus @default(PENDING)
  // no DB uniqueness for doctor slot
}
```

```js
const existingBooking = await prisma.appointment.findFirst({
  where: { doctorId, appointmentDate: appDate, status: { not: 'CANCELLED' } },
});
```

## Why It Fails
- Conflict prevention relies only on application logic.
- Concurrent requests can both pass availability checks and create duplicates.
- No database constraint guarantees doctor-slot uniqueness.

## Solution (Design)
```prisma
model Appointment {
  // slot key fields
  doctorId        String
  appointmentDate DateTime

  @@unique([doctorId, appointmentDate])
}
```

```js
try {
  const appointment = await prisma.appointment.create({
    data: {
      patientId,
      doctorId,
      appointmentDate,
      reason,
      status: 'PENDING',
    },
  });
} catch (error) {
  if (error.code === 'P2002') {
    return res.status(409).json({
      error: 'Doctor already has an appointment in this slot.',
    });
  }
}
```

## What This Fix Does
- Enforces appointment slot uniqueness at the database level.
- Prevents race-condition double bookings.
- Removes reliance on application-only validation.
