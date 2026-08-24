const test = require('node:test');
const assert = require('node:assert/strict');
const { deadlineForToday } = require('../src/lib/lateAlert');

test('college deadline is calculated in Asia/Kolkata', () => {
  const previousZone = process.env.APP_TIMEZONE;
  const previousDeadline = process.env.COLLEGE_ARRIVAL_DEADLINE;
  process.env.APP_TIMEZONE = 'Asia/Kolkata';
  process.env.COLLEGE_ARRIVAL_DEADLINE = '09:50';
  const result = deadlineForToday(new Date('2026-08-24T01:00:00.000Z'));
  assert.equal(result.toISOString(), '2026-08-24T04:20:00.000Z');
  process.env.APP_TIMEZONE = previousZone;
  process.env.COLLEGE_ARRIVAL_DEADLINE = previousDeadline;
});
