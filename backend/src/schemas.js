const { z } = require('zod');

const idParam = z.object({ id: z.coerce.number().int().positive() });
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM (24-hour)');

const routeServiceSchema = z.object({
  routeNo: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(150),
  areaCovered: z.string().trim().min(1).max(500),
  capacity: z.number().int().positive().max(200),
  driverId: z.number().int().positive().nullable().optional(),
});

const stopSchema = z.object({
  name: z.string().trim().min(1).max(150),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const driverCreateSchema = z.object({
  driverCode: z.string().trim().min(2).max(50),
  name: z.string().trim().min(1).max(150),
  phone: z.string().trim().min(5).max(30),
  licenseNo: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(200),
});

const driverUpdateSchema = driverCreateSchema.partial();

const classAdvisorSchema = z.object({
  name: z.string().trim().min(1).max(150),
  phone: z.string().trim().min(5).max(30),
  email: z.string().trim().email(),
  department: z.string().trim().min(1).max(100),
  year: z.number().int().positive().max(10),
  section: z.string().trim().min(1).max(30),
});

const scheduleVersionSchema = z.object({
  routeServiceId: z.number().int().positive(),
  name: z.string().trim().min(1).max(150),
  direction: z.string().trim().min(1).max(30).default('MORNING'),
  effectiveFrom: z.coerce.date().nullable().optional(),
});

const scheduleStopSchema = z.object({
  stopId: z.number().int().positive(),
  sequenceOrder: z.number().int().nonnegative(),
  scheduledTime: hhmm,
});

const rosterCreateSchema = z.object({
  name: z.string().trim().min(1).max(150),
  academicYear: z.string().trim().regex(/^\d{4}-\d{2,4}$/, 'Academic year must look like 2026-27'),
  copyFromRosterId: z.number().int().positive().optional(),
});

const rosterPassengerSchema = z
  .object({
    routeServiceId: z.number().int().positive(),
    boardingStopId: z.number().int().positive(),
    passengerType: z.enum(['STUDENT', 'FACULTY']),
    name: z.string().trim().min(1).max(150),
    busPassId: z.string().trim().min(1).max(100),
    rollNo: z.string().trim().min(1).max(100).nullable().optional(),
    facultyId: z.string().trim().min(1).max(100).nullable().optional(),
    department: z.string().trim().min(1).max(100).nullable().optional(),
    year: z.number().int().positive().max(10).nullable().optional(),
    section: z.string().trim().min(1).max(30).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.passengerType === 'STUDENT') {
      for (const field of ['rollNo', 'department', 'year', 'section']) {
        if (value[field] === null || value[field] === undefined || value[field] === '') {
          ctx.addIssue({ code: 'custom', path: [field], message: `${field} is required for a student` });
        }
      }
      if (value.facultyId) {
        ctx.addIssue({ code: 'custom', path: ['facultyId'], message: 'facultyId is not valid for a student' });
      }
    } else {
      if (!value.facultyId) {
        ctx.addIssue({ code: 'custom', path: ['facultyId'], message: 'facultyId is required for faculty' });
      }
      if (value.rollNo || value.year || value.section) {
        ctx.addIssue({ code: 'custom', path: ['passengerType'], message: 'Student-only fields are not valid for faculty' });
      }
    }
  });

const locationPayloadSchema = z.object({
  tripId: z.number().int().positive(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  deviceTimestamp: z.coerce.date().optional(),
});

module.exports = {
  idParam,
  hhmm,
  routeServiceSchema,
  stopSchema,
  driverCreateSchema,
  driverUpdateSchema,
  classAdvisorSchema,
  scheduleVersionSchema,
  scheduleStopSchema,
  rosterCreateSchema,
  rosterPassengerSchema,
  locationPayloadSchema,
};
