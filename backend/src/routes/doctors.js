const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/doctors
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, specialization } = req.query;

    const where = {};

    if (search) {
      where.name = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (specialization && specialization !== 'All') {
      where.specialization = specialization;
    }

    const doctors = await prisma.doctor.findMany({
      where,
    });

    return res.json({
      success: true,
      data: doctors,
    });
  } catch (error) {
    console.error('Get doctors error:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// GET /api/doctors/stats
router.get('/stats', authenticate, async (req, res) => {
  try {
    const [
      totalDoctors,
      surgeonsCount,
      averageFee,
      highestExperience,
    ] = await Promise.all([
      prisma.doctor.count(),

      prisma.doctor.count({
        where: {
          department: 'Surgery',
        },
      }),

      prisma.doctor.aggregate({
        _avg: {
          consultationFee: true,
        },
      }),

      prisma.doctor.aggregate({
        _max: {
          experience: true,
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        total: totalDoctors,
        surgeons: surgeonsCount,
        averageFee: Math.round(
          averageFee._avg.consultationFee || 0
        ),
        maxExperience:
          highestExperience._max.experience || 0,
      },
    });
  } catch (error) {
    console.error('Doctor stats error:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// GET /api/doctors/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!doctor) {
      return res.status(404).json({
        success: false,
        error: 'Doctor not found',
      });
    }

    return res.json({
      success: true,
      data: doctor,
    });
  } catch (error) {
    console.error('Get doctor error:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

module.exports = router;