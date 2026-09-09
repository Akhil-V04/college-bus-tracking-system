const express = require('express');
const prisma = require('../lib/prisma');
const { crudRouter } = require('../crud');
const { stopSchema } = require('../schemas');

const router = express.Router();

// publicGet: the student app needs to fetch stops without auth
const stopCrud = crudRouter({
  delegate: prisma.stop,
  createSchema: stopSchema,
  updateSchema: stopSchema.partial(),
  publicGet: true,
  audit: {
    prisma,
    delegateName: 'stop',
    entityType: 'Stop',
    actions: { create: 'STOP_CREATED', update: 'STOP_UPDATED', delete: 'STOP_DELETED' },
    summarize: ({ name, latitude, longitude, geofenceRadiusM }) => ({
      name,
      latitude,
      longitude,
      geofenceRadiusM,
    }),
  },
});
router.use('/', stopCrud);

module.exports = router;