const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();
const VALID_QUEUE_STATUSES = ['WAITING', 'CALLING', 'COMPLETED', 'SKIPPED'];

// GET /api/queue
// List all active queue tokens
router.get(
  '/',
  authenticate,
  authorize(['DOCTOR', 'RECEPTIONIST', 'ADMIN']),
  async (req, res) => {
  try {
    const { doctorId, status } = req.query;
    const tokenDate = new Date();
    tokenDate.setHours(0, 0, 0, 0);

    const where = {
      tokenDate,
    };

    // Default to active queue items only
    where.status = {
      in: ['WAITING', 'CALLING'],
    };

    if (doctorId) where.doctorId = doctorId;

    if (status) {
      if (!VALID_QUEUE_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid queue status filter' });
      }
      where.status = status;
    }

    const tokens = await prisma.queueToken.findMany({
      where,
      include: {
        patient: true,
        doctor: true,
      },
      orderBy: { tokenNumber: 'asc' },
    });

    return res.json(tokens);
  } catch (error) {
    console.error('Get queue error:', error);
    return res.status(500).json({ error: 'Failed to retrieve queue' });
  }
});

// POST /api/queue/checkin
// Generate a new queue token for a patient
router.post(
  '/checkin',
  authenticate,
  authorize(['RECEPTIONIST', 'ADMIN']),
  async (req, res) => {
  try {
    const { patientId, doctorId, appointmentId } = req.body;

    if (!patientId || !doctorId) {
      return res.status(400).json({ error: 'Patient and doctor ID are required for check-in.' });
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    if (appointmentId) {
      const appointment = await prisma.appointment.findUnique({
        where: { id: appointmentId },
      });

      if (!appointment) {
        return res.status(404).json({ error: 'Appointment not found' });
      }

      if (appointment.patientId !== patientId || appointment.doctorId !== doctorId) {
        return res.status(400).json({
          error: 'Appointment does not belong to the provided patient and doctor.',
        });
      }
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
    return res.status(500).json({ error: 'Check-in failed' });
  }
});

// PATCH /api/queue/:id
// Update token status (WAITING -> CALLING -> COMPLETED / SKIPPED)
router.patch(
  '/:id',
  authenticate,
  authorize(['DOCTOR', 'ADMIN']),
  async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    if (!VALID_QUEUE_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const existingToken = await prisma.queueToken.findUnique({
      where: { id: req.params.id },
    });

    if (!existingToken) {
      return res.status(404).json({ error: 'Queue token not found' });
    }

    if (
      (existingToken.status === 'WAITING' && !['CALLING', 'SKIPPED'].includes(status)) ||
      (existingToken.status === 'CALLING' && !['COMPLETED', 'SKIPPED'].includes(status)) ||
      ['COMPLETED', 'SKIPPED'].includes(existingToken.status)
    ) {
      return res.status(400).json({
        error: `Invalid status transition from ${existingToken.status} to ${status}`,
      });
    }

    const updatedToken = await prisma.queueToken.update({
      where: { id: req.params.id },
      data: { status },
      include: {
        patient: true,
        doctor: true,
      },
    });

    return res.json(updatedToken);
  } catch (error) {
    console.error('Update queue token error:', error);
    return res.status(500).json({ error: 'Failed to update queue token' });
  }
});

module.exports = router;
