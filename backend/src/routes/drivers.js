const express = require('express');
const prisma = require('../lib/prisma');
const { crudRouter } = require('../crud');
const { driverSchema } = require('../schemas');

const router = express.Router();

// Always omit passwordHash from driver responses.
const driverSafeSelect = {
  id: true,
  name: true,
  phone: true,
  licenseNo: true,
};

const driverCrud = crudRouter({
  delegate: prisma.driver,
  createSchema: driverSchema,
  updateSchema: driverSchema.omit({ passwordHash: true }).partial(),
  select: driverSafeSelect,
});
router.use('/', driverCrud);

module.exports = router;