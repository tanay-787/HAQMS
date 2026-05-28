const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/patients
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, gender } = req.query;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 5;
    const skip = (page - 1) * limit;

    const where = {};

    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          phoneNumber: {
            contains: search,
          },
        },
        {
          email: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (gender && gender !== 'All') {
      where.gender = {
        equals: gender,
        mode: 'insensitive',
      };
    }

    const [patients, totalPatients] = await Promise.all([
      prisma.patient.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.patient.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        patients,
        pagination: {
          page,
          limit,
          totalPatients,
          totalPages: Math.ceil(totalPatients / limit),
        },
      },
    });
  } catch (error) {
    console.error('Get patients error:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// GET /api/patients/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: {
        id: req.params.id,
      },
      include: {
        appointments: true,
      },
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found',
      });
    }

    return res.json({
      success: true,
      data: patient,
    });
  } catch (error) {
    console.error('Get patient error:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// POST /api/patients
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      name,
      email,
      phoneNumber,
      age,
      gender,
      medicalHistory,
    } = req.body;

    if (!name || !phoneNumber || !age || !gender) {
      return res.status(400).json({
        success: false,
        error: 'Name, phoneNumber, age, and gender are required.',
      });
    }

    if (!/^\d{10}$/.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Phone number must be a valid 10-digit number.',
      });
    }

    const parsedAge = Number(age);

    if (!Number.isInteger(parsedAge) || parsedAge <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Age must be a valid positive integer.',
      });
    }

    const patient = await prisma.patient.create({
      data: {
        name,
        email: email || null,
        phoneNumber,
        age: parsedAge,
        gender,
        medicalHistory: medicalHistory || null,
      },
    });

    return res.status(201).json({
      success: true,
      data: patient,
    });
  } catch (error) {
    console.error('Create patient error:', error);

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

// DELETE /api/patients/:id
router.delete(
  '/:id',
  authenticate,
  authorize('ADMIN'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const patient = await prisma.patient.findUnique({
        where: { id },
      });

      if (!patient) {
        return res.status(404).json({
          success: false,
          error: 'Patient not found',
        });
      }

      await prisma.patient.delete({
        where: { id },
      });

      return res.json({
        success: true,
        message: `Successfully deleted patient ${patient.name}`,
      });
    } catch (error) {
      console.error('Delete patient error:', error);

      return res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
);

module.exports = router;