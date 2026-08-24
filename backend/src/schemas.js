const { z } = require('zod');

const idParam = z.object({
  id: z.coerce.number().int().positive(),
});

// Entity schemas for create/update validation.
// Update schemas are partial() so clients can send only the fields they change.

const routeSchema = z.object({
  routeNo: z.string().min(1),
  name: z.string().min(1),
  areaCovered: z.string().min(1),
});

const stopSchema = z.object({
  name: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const routeStopSchema = z.object({
  routeId: z.number().int().positive(),
  stopId: z.number().int().positive(),
  sequenceOrder: z.number().int().nonnegative(),
  scheduledTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'scheduledTime must be HH:MM (24-hour)',
  }),
});

const driverSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  licenseNo: z.string().min(1),
  passwordHash: z.string().min(1),
});

const busSchema = z.object({
  busNo: z.string().min(1),
  routeId: z.number().int().positive(),
  driverId: z.number().int().positive().nullable().optional(),
  capacity: z.number().int().positive(),
  plateNumber: z.string().min(1),
});

const classAdvisorSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  department: z.string().min(1),
  year: z.number().int().positive(),
  section: z.string().min(1),
  googleId: z.string().nullable().optional(),
});

const studentSchema = z.object({
  rollNo: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  routeId: z.number().int().positive(),
  year: z.number().int().positive(),
  department: z.string().min(1),
  section: z.string().min(1),
  boardingStopId: z.number().int().positive(),
  googleId: z.string().nullable().optional(),
});

module.exports = {
  idParam,
  routeSchema,
  stopSchema,
  routeStopSchema,
  driverSchema,
  busSchema,
  classAdvisorSchema,
  studentSchema,
};