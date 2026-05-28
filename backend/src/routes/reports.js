const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/reports/doctor-stats
router.get('/doctor-stats', authenticate, async (req, res) => {
  try {
    const start = Date.now();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [doctors, appointmentStats, queueStats] = await Promise.all([
      prisma.doctor.findMany({
        select: {
          id: true,
          name: true,
          specialization: true,
          department: true,
          consultationFee: true,
        },
      }),
      prisma.appointment.groupBy({
        by: ['doctorId', 'status'],
        _count: {
          _all: true,
        },
      }),
      prisma.queueToken.groupBy({
        by: ['doctorId'],
        where: {
          tokenDate: today,
        },
        _count: {
          _all: true,
        },
      }),
    ]);

    const appointmentMap = {};
    for (const row of appointmentStats) {
      if (!appointmentMap[row.doctorId]) {
        appointmentMap[row.doctorId] = {
          totalAppointments: 0,
          completedAppointments: 0,
          cancelledAppointments: 0,
        };
      }

      appointmentMap[row.doctorId].totalAppointments += row._count._all;

      if (row.status === 'COMPLETED') {
        appointmentMap[row.doctorId].completedAppointments = row._count._all;
      }
      if (row.status === 'CANCELLED') {
        appointmentMap[row.doctorId].cancelledAppointments = row._count._all;
      }
    }

    const queueMap = {};
    for (const row of queueStats) {
      queueMap[row.doctorId] = row._count._all;
    }

    const reportData = doctors.map((doc) => {
      const doctorAppointments = appointmentMap[doc.id] || {
        totalAppointments: 0,
        completedAppointments: 0,
        cancelledAppointments: 0,
      };

      return {
        id: doc.id,
        name: doc.name,
        specialization: doc.specialization,
        department: doc.department,
        totalAppointments: doctorAppointments.totalAppointments,
        completedAppointments: doctorAppointments.completedAppointments,
        cancelledAppointments: doctorAppointments.cancelledAppointments,
        todayQueueSize: queueMap[doc.id] || 0,
        revenue: doctorAppointments.completedAppointments * doc.consultationFee,
      };
    });

    const durationMs = Date.now() - start;

    return res.json({
      success: true,
      timeTakenMs: durationMs,
      data: reportData,
    });
  } catch (error) {
    console.error('Generate report error:', error);

    return res.status(500).json({ error: 'Failed to generate report' });
  }
});

module.exports = router;
