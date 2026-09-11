const { adaptiveGpsPolicy, shouldTransmit } = require('../src/lib/adaptiveGpsPolicy');

const cases = [
  { name: 'normal', state: {}, expected: 'NORMAL' },
  { name: 'near-stop', state: { distanceToNextStopMeters: 300 }, expected: 'TRANSITION' },
  { name: 'stationary', state: { stationaryDurationMs: 45000 }, expected: 'STATIONARY' },
  { name: 'reconnect', state: { reason: 'RECONNECT' }, expected: 'IMMEDIATE' },
];

const results = cases.map((item) => {
  const policy = adaptiveGpsPolicy(item.state, {});
  if (policy.mode !== item.expected) throw new Error(`Adaptive GPS case failed: ${item.name}`);
  return {
    case: item.name,
    mode: policy.mode,
    collectionIntervalMs: policy.collectionIntervalMs,
    sendIntervalMs: policy.sendIntervalMs,
    sendsImmediately: shouldTransmit(new Date(), new Date(), policy),
  };
});
console.log(JSON.stringify({ verified: true, cases: results }));
