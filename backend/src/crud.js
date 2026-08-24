const express = require('express');
const { idParam } = require('./schemas');
const { requireAuth } = require('./middleware/auth');

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
  const skip = (page - 1) * limit;
  return { page, limit, skip, take: limit };
}

// Validation helper: strips unknown keys, returns parsed data or a 400 response.
function validate(schema, data, res) {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map((i) => i.message).join('; ') });
    return null;
  }
  return parsed.data;
}

// Options:
//   - delegate: prisma client delegate, e.g. prisma.route
//   - createSchema / updateSchema: zod schemas (create required, update defaults to partial)
//   - select: field-selection object to shape responses (e.g. omit passwordHash)
//   - include: relations to include on reads and creates
//   - idSchema: defaults to idParam
//   - publicGet: if true, GET list is public (no auth). Default false.
//   - extraIncludes: if present, GET list includes related records too, e.g.
//     relateInList flag to include relations on list reads.
function crudRouter(options) {
  const {
    delegate,
    createSchema,
    updateSchema = createSchema.partial(),
    select,
    include,
    idSchema = idParam,
    publicGet = false,
  } = options;

  if (!createSchema) throw new Error('crudRouter requires createSchema');

  const router = express.Router();

  // Routes mounted in order:
  //   - the list-handler protects itself based on publicGet
  //   - mutations always require admin
  const listHandler = async (req, res) => {
    try {
      const { page, limit, skip, take } = parsePagination(req.query);
      const [items, total] = await Promise.all([
        delegate.findMany({
          skip,
          take,
          select,
          include,
          orderBy: { id: 'asc' },
        }),
        delegate.count(),
      ]);
      return res.json({
        items,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (err) {
      console.error('list error', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };

  // GET / — list all (paginated); public if publicGet, else admin-only
  router.get(
    '/',
    publicGet ? listHandler : [requireAuth(['admin']), listHandler]
  );

// POST / — create (validate body)
  router.post('/', requireAuth(['admin']), async (req, res) => {
    try {
      const data = validate(createSchema, req.body, res);
      if (data === null) return;
      const item = await delegate.create({ data, select, include });
      res.status(201).json(item);
    } catch (err) {
      handleUniqueError(err, res);
    }
  });

  // PUT /:id — update by id (validate body)
  router.put('/:id', requireAuth(['admin']), async (req, res) => {
    try {
      const { id } = validate(idSchema, req.params, res) ?? { id: NaN };
      if (Number.isNaN(id)) return;
      const data = validate(updateSchema, req.body, res);
      if (data === null) return;
      const item = await delegate.update({ where: { id }, data, select, include });
      res.json(item);
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found' });
      handleUniqueError(err, res);
    }
  });

  // DELETE /:id — delete by id
  router.delete('/:id', requireAuth(['admin']), async (req, res) => {
    try {
      const { id } = validate(idSchema, req.params, res) ?? { id: NaN };
      if (Number.isNaN(id)) return;
      await delegate.delete({ where: { id } });
      res.json({ deleted: true, id });
    } catch (err) {
      if (err.code === 'P2025') return res.status(404).json({ error: 'Record not found' });
      handleUniqueError(err, res);
    }
  });

  return router;
}

// Prisma throws P2002 on unique-constraint violations.
function handleUniqueError(err, res) {
  if (err.code === 'P2002') {
    const field = err.meta?.target ?? 'value';
    return res.status(409).json({ error: `A record with that ${field} already exists` });
  }
  console.error('db error', err);
  res.status(500).json({ error: 'Internal server error' });
}

module.exports = { crudRouter, parsePagination, validate };
