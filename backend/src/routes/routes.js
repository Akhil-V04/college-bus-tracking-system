const express = require('express');
const prisma = require('../lib/prisma');
const { crudRouter } = require('../crud');
const { routeSchema } = require('../schemas');

const router = express.Router();

// GET /routes — public list of all routes (no pagination, simplest for clients)
router.get('/', async (req, res) => {
  try {
    const routes = await prisma.route.findMany({ orderBy: { id: 'asc' } });
    res.json(routes);
  } catch (err) {
    console.error('routes list error', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Admin CRUD (POST, PUT, DELETE). We register the crud router under a sub-path so
// this file's public GET / stays the canonical public list. The crud GET is still
// available (paginated) at /routes/crud for admin use.
const routeCrud = crudRouter({
  delegate: prisma.route,
  createSchema: routeSchema,
  updateSchema: routeSchema.partial(),
});
router.use('/crud', routeCrud);

module.exports = router;