const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/queue
// List all active queue tokens
router.get('/', authenticate, async (req, res) => {
  try {
    const { doctorId, status } = req.query;

    const where = {};
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = status;

    const tokens = await prisma.queueToken.findMany({
      where,
      include: {
        patient: true,
        doctor: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(tokens);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve queue', details: error.message });
  }
});

// POST /api/queue/checkin
// Generate a new queue token for a patient
// CONCURRENCY/RACE CONDITION BUG: Token increment uses aggregate read followed by create.
// Introduce a deliberate asynchronous delay (setTimeout) to force a wide race window
// where concurrent check-ins assign the exact same token number.
router.post('/checkin', authenticate, async (req, res) => {
  try {
    const { patientId, doctorId, appointmentId } = req.body;

    if (!patientId || !doctorId) {
      return res.status(400).json({ error: 'Patient and Doctor ID are required for check-in.' });
    }

    // Normalize to date-only for per-day token allocation
    const tokenDate = new Date();
    tokenDate.setHours(0, 0, 0, 0);

    const maxRetries = 5;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // 1. Fetch current maximum token number for this doctor on this date
      const maxTokenResult = await prisma.queueToken.aggregate({
        where: {
          doctorId,
          tokenDate,
        },
        _max: {
          tokenNumber: true,
        },
      });

      const currentMax = maxTokenResult._max.tokenNumber || 0;
      const nextTokenNumber = currentMax + 1;

      // 2. Try to insert new token. If a concurrent request inserted the same token
      // a unique constraint violation (P2002) will occur and we retry.
      try {
        const newToken = await prisma.queueToken.create({
          data: {
            tokenNumber: nextTokenNumber,
            tokenDate,
            patientId,
            doctorId,
            appointmentId: appointmentId || null,
            status: 'WAITING',
          },
          include: {
            patient: true,
            doctor: true,
          },
        });

        return res.status(201).json({
          message: 'Checked in successfully. Token generated.',
          token: newToken,
        });
      } catch (error) {
        // Unique constraint violation: another concurrent request inserted same token
        if (error.code === 'P2002') {
          // Small randomized backoff then retry
          await new Promise((r) => setTimeout(r, 50 + Math.floor(Math.random() * 150)));
          continue;
        }
        throw error;
      }
    }

    return res.status(500).json({ error: 'Failed to allocate token after multiple attempts' });
  } catch (error) {
    console.error('Queue check-in error:', error);
    res.status(500).json({ error: 'Check-in failed', details: error.message });
  }
});

// PATCH /api/queue/:id
// Update token status (WAITING -> CALLING -> COMPLETED / SKIPPED)
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const updatedToken = await prisma.queueToken.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        patient: true,
        doctor: true,
      },
    });

    res.json(updatedToken);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update queue token', details: error.message });
  }
});

module.exports = router;
