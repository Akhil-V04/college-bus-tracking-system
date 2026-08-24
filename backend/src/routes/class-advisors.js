const express = require('express');
const prisma = require('../lib/prisma');
const { crudRouter } = require('../crud');
const { classAdvisorSchema } = require('../schemas');

const router = express.Router();

const classAdvisorCrud = crudRouter({
  delegate: prisma.classAdvisor,
  createSchema: classAdvisorSchema,
  updateSchema: classAdvisorSchema.partial(),
});
router.use('/', classAdvisorCrud);

module.exports = router;