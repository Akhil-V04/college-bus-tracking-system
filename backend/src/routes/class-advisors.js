const express = require('express');
const prisma = require('../lib/prisma');
const { crudRouter } = require('../crud');
const { classAdvisorSchema } = require('../schemas');

const router = express.Router();

const classAdvisorCrud = crudRouter({
  delegate: prisma.classAdvisor,
  createSchema: classAdvisorSchema,
  updateSchema: classAdvisorSchema.partial(),
  audit: {
    prisma,
    delegateName: 'classAdvisor',
    entityType: 'ClassAdvisor',
    actions: {
      create: 'CLASS_ADVISOR_CREATED',
      update: 'CLASS_ADVISOR_UPDATED',
      delete: 'CLASS_ADVISOR_DELETED',
    },
    summarize: ({ department, year, section }) => ({ department, year, section }),
  },
});
router.use('/', classAdvisorCrud);

module.exports = router;