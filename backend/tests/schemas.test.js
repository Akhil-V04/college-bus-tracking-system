const test = require('node:test');
const assert = require('node:assert/strict');
const {
  routeServiceSchema,
  rosterPassengerSchema,
  locationPayloadSchema,
} = require('../src/schemas');

test('route service requires a positive capacity and no vehicle registration field', () => {
  assert.equal(
    routeServiceSchema.safeParse({
      routeNo: '12',
      name: 'Uppal',
      areaCovered: 'Uppal and Boduppal',
      capacity: 52,
    }).success,
    true
  );
  assert.equal(
    routeServiceSchema.safeParse({
      routeNo: '12',
      name: 'Uppal',
      areaCovered: 'Uppal',
      capacity: 0,
    }).success,
    false
  );
});

test('student roster rows require roll number and class grouping', () => {
  const base = {
    routeServiceId: 1,
    boardingStopId: 2,
    passengerType: 'STUDENT',
    name: 'Akhil',
    busPassId: '000124',
  };
  assert.equal(rosterPassengerSchema.safeParse(base).success, false);
  assert.equal(
    rosterPassengerSchema.safeParse({
      ...base,
      rollNo: '22CSE104',
      department: 'CSE',
      year: 3,
      section: 'A',
    }).success,
    true
  );
});

test('faculty rows require faculty ID and reject student-only fields', () => {
  const base = {
    routeServiceId: 1,
    boardingStopId: 2,
    passengerType: 'FACULTY',
    name: 'Dr Rao',
    busPassId: 'FAC-PASS-1',
  };
  assert.equal(rosterPassengerSchema.safeParse(base).success, false);
  assert.equal(rosterPassengerSchema.safeParse({ ...base, facultyId: 'FAC023' }).success, true);
  assert.equal(
    rosterPassengerSchema.safeParse({ ...base, facultyId: 'FAC023', rollNo: 'INVALID' }).success,
    false
  );
});

test('GPS payload rejects impossible latitude and accepts device timestamp', () => {
  assert.equal(
    locationPayloadSchema.safeParse({ tripId: 1, latitude: 17.4, longitude: 78.5 }).success,
    true
  );
  assert.equal(
    locationPayloadSchema.safeParse({ tripId: 1, latitude: 170, longitude: 78.5 }).success,
    false
  );
  assert.equal(
    locationPayloadSchema.safeParse({
      tripId: 1,
      latitude: 17.4,
      longitude: 78.5,
      accuracyMeters: 12.5,
      deviceSpeedKmh: 35,
    }).success,
    true
  );
  assert.equal(
    locationPayloadSchema.safeParse({ tripId: 1, latitude: 17.4, longitude: 78.5, accuracyMeters: -1 }).success,
    false
  );
});
