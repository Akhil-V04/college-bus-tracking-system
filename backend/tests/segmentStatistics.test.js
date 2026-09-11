const test = require('node:test');
const assert = require('node:assert/strict');

const { classifyDuration, median, medianAbsoluteDeviation } = require('../src/lib/segmentStatistics');

test('median and MAD resist a single long disruption', () => {
  const normal = [450, 460, 470, 480, 480, 490, 500, 510];
  assert.equal(median(normal), 480);
  assert.equal(medianAbsoluteDeviation(normal), 15);
  assert.equal(classifyDuration(31 * 60, normal).classification, 'DISRUPTION');
});

test('sparse segment history remains usable with low implied confidence', () => {
  assert.deepEqual(classifyDuration(480, [450, 510]), { classification: 'NORMAL', deviationScore: null });
});
