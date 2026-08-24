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
});
router.use('/', stopCrud);

module.exports = router;