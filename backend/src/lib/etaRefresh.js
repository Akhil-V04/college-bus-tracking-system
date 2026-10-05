const prisma = require('./prisma');
const { estimateArrival } = require('./eta');

const refreshes = new Map();

function etaIntervalMs(env = process.env) {
  const value = Number(env.ETA_RECALC_INTERVAL_MS || 20000);
  return Number.isFinite(value) && value >= 15000 && value <= 30000 ? value : 20000;
}

function isEtaRefreshDue(lastCalculatedAt, meaningfulTransition = false, now = new Date(), env = process.env) {
  if (meaningfulTransition || !lastCalculatedAt) return true;
  return now.getTime() - new Date(lastCalculatedAt).getTime() >= etaIntervalMs(env);
}

async function refreshTripEta(tripId) {
  if (refreshes.has(tripId)) return refreshes.get(tripId);
  const task = (async () => {
    const eta = await estimateArrival(tripId);
    if (!eta) return null;
    const calculatedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.trip.update({ where: { id: tripId }, data: { currentEta: eta, currentEtaAt: calculatedAt } });
      if (String(process.env.ETA_CALIBRATION_ENABLED).toLowerCase() === 'true') {
        await tx.etaCalibrationSnapshot.create({ data: { tripId, calculatedAt, payload: eta } });
      }
    });
    return { eta, calculatedAt };
  })().finally(() => refreshes.delete(tripId));
  refreshes.set(tripId, task);
  return task;
}

module.exports = { etaIntervalMs, isEtaRefreshDue, refreshTripEta };
