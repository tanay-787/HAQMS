const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();
const VALID_APPOINTMENT_STATUSES = ['PENDING', 'COMPLETED', 'CANCELLED'];

// GET /api/appointments
// List all appointments
router.get(
  '/',
  authenticate,
  authorize(['DOCTOR', 'RECEPTIONIST', 'ADMIN']),
  async (req, res) => {
  try {
    const { doctorId, status } = req.query;

    const where = {};
    if (doctorId) where.doctorId = doctorId;
    if (status) where.status = status;

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            age: true,
            medicalHistory: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            specialization: true,
          },
        },
      },
      orderBy: { appointmentDate: 'asc' },
    });

    return res.json({
      success: true,
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    console.error('Get appointments error:', error);
    return res.status(500).json({ error: 'Failed to retrieve appointments' });
  }
});

// POST /api/appointments
// Book an appointment
router.post(
  '/',
  authenticate,
  authorize(['RECEPTIONIST', 'ADMIN']),
  async (req, res) => {
  try {
    const { patientId, doctorId, appointmentDate, reason } = req.body;

    if (!patientId || !doctorId || !appointmentDate) {
      return res.status(400).json({ error: 'Patient, Doctor, and Appointment Date are required.' });
    }

    const appDate = new Date(appointmentDate);

    if (isNaN(appDate.getTime())) {
      return res.status(400).json({ error: 'Invalid appointment date' });
    }

    const [patient, doctor] = await Promise.all([
      prisma.patient.findUnique({
        where: { id: patientId },
      }),
      prisma.doctor.findUnique({
        where: { id: doctorId },
      }),
    ]);

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    if (appDate < new Date()) {
      return res.status(400).json({ error: 'Appointment date must be in the future' });
    }

    const appointment = await prisma.appointment.create({
      data: {
        patientId,
        doctorId,
        appointmentDate: appDate,
        reason: reason || '',
        status: 'PENDING',
      },
    });

    return res.status(201).json({
      message: 'Appointment booked successfully',
      appointment,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: 'Doctor already has an appointment in this slot.',
      });
    }
    console.error('Book appointment error:', error);
    return res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// PATCH /api/appointments/:id
// Update appointment status (COMPLETED, CANCELLED, etc.)
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

    if (!VALID_APPOINTMENT_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid appointment status' });
    }

    const updated = await prisma.appointment.update({
      where: { id: req.params.id },
      data: { status },
    });

    return res.json(updated);
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    console.error('Update appointment error:', error);
    return res.status(500).json({ error: 'Failed to update appointment' });
  }
});

module.exports = router;
