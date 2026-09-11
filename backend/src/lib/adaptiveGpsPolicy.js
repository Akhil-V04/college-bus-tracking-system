const IMMEDIATE_REASONS = new Set(['TRIP_START', 'TRIP_END', 'RECONNECT', 'GPS_RECOVERED']);

function boundedMs(value, fallback, minimum, maximum) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

function adaptiveGpsPolicy(state = {}, env = process.env) {
  const collectionIntervalMs = boundedMs(env.GPS_COLLECTION_INTERVAL_MS, 5000, 1000, 10000);
  if (IMMEDIATE_REASONS.has(state.reason)) {
    return { collectionIntervalMs, sendIntervalMs: 0, mode: 'IMMEDIATE', sendNow: true, reason: state.reason };
  }
  const stationary = Number(state.stationaryDurationMs || 0) >= 30000;
  const transition = Boolean(state.transitioning) ||
    (Number.isFinite(state.distanceToNextStopMeters) &&
      state.distanceToNextStopMeters <= boundedMs(env.GPS_TRANSITION_DISTANCE_METERS, 500, 100, 1500));
  if (stationary) {
    return {
      collectionIntervalMs,
      sendIntervalMs: boundedMs(env.GPS_SEND_STATIONARY_INTERVAL_MS, 30000, 25000, 45000),
      mode: 'STATIONARY', sendNow: false, reason: 'SUSTAINED_STATIONARY',
    };
  }
  if (transition) {
    return {
      collectionIntervalMs,
      sendIntervalMs: boundedMs(env.GPS_SEND_TRANSITION_INTERVAL_MS, 7000, 5000, 10000),
      mode: 'TRANSITION', sendNow: false, reason: 'NEAR_STOP_OR_TRANSITION',
    };
  }
  return {
    collectionIntervalMs,
    sendIntervalMs: boundedMs(env.GPS_SEND_NORMAL_INTERVAL_MS, 12000, 10000, 15000),
    mode: 'NORMAL', sendNow: false, reason: 'NORMAL_PROGRESS',
  };
}

function shouldTransmit(lastSentAt, now, policy) {
  if (policy.sendNow || !lastSentAt) return true;
  return new Date(now).getTime() - new Date(lastSentAt).getTime() >= policy.sendIntervalMs;
}

module.exports = { IMMEDIATE_REASONS, adaptiveGpsPolicy, shouldTransmit };
