const prisma = require('./prisma');

function thresholdPlan(etaMinutes, thresholds, delivered = []) {
  if (!Number.isFinite(etaMinutes) || etaMinutes < 0) return { send: null, skip: [] };
  const crossed = [...new Set(thresholds)]
    .filter((value) => [1, 5, 10].includes(value) && etaMinutes <= value && !delivered.includes(value))
    .sort((a, b) => a - b);
  if (!crossed.length) return { send: null, skip: [] };
  return { send: crossed[0], skip: crossed.slice(1) };
}

async function enqueueStopArrivalAlerts(tripId, eta) {
  if (!eta || !['UPCOMING', 'ARRIVING'].includes(eta.status) || !Array.isArray(eta.stops)) {
    return { enqueued: 0, skipped: 0 };
  }
  const trip = await prisma.trip.findUnique({
    where: { id: tripId }, select: { id: true, routeServiceId: true, status: true },
  });
  if (!trip || trip.status !== 'RUNNING') return { enqueued: 0, skipped: 0 };
  const etaByStop = new Map(eta.stops.map((stop) => [stop.stopId, stop]));
  const subscriptions = await prisma.stopAlertSubscription.findMany({
    where: {
      routeServiceId: trip.routeServiceId,
      active: true,
      device: { active: true, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    },
    include: {
      device: { select: { id: true } },
      deliveries: { where: { tripId }, select: { thresholdMinutes: true } },
      stop: { select: { name: true } },
      routeService: { select: { routeNo: true } },
    },
  });
  let enqueued = 0;
  let skipped = 0;
  for (const subscription of subscriptions) {
    const stopEta = etaByStop.get(subscription.stopId);
    if (!stopEta || !Number.isFinite(stopEta.etaMinutes)) continue;
    const delivered = subscription.deliveries.map((item) => item.thresholdMinutes);
    const plan = thresholdPlan(stopEta.etaMinutes, subscription.thresholdsMinutes, delivered);
    if (!plan.send) continue;
    try {
      await prisma.$transaction(async (tx) => {
        for (const threshold of plan.skip) {
          await tx.stopAlertDelivery.create({
            data: {
              subscriptionId: subscription.id,
              tripId,
              thresholdMinutes: threshold,
              status: 'SKIPPED',
              idempotencyKey: `stop:${subscription.id}:trip:${tripId}:threshold:${threshold}`,
            },
          });
        }
        const delivery = await tx.stopAlertDelivery.create({
          data: {
            subscriptionId: subscription.id,
            tripId,
            thresholdMinutes: plan.send,
            status: 'PENDING',
            idempotencyKey: `stop:${subscription.id}:trip:${tripId}:threshold:${plan.send}`,
          },
        });
        await tx.pushNotificationOutbox.create({
          data: {
            pushDeviceSubscriptionId: subscription.device.id,
            idempotencyKey: `stop-alert-delivery:${delivery.id}`,
            payload: {
              type: 'STOP_ARRIVAL',
              deliveryId: delivery.id,
              tripId,
              routeNo: subscription.routeService.routeNo,
              stopId: subscription.stopId,
              stopName: subscription.stop.name,
              thresholdMinutes: plan.send,
              etaMinutes: stopEta.etaMinutes,
            },
          },
        });
      });
      enqueued += 1;
      skipped += plan.skip.length;
    } catch (error) {
      if (error.code !== 'P2002') throw error;
    }
  }
  return { enqueued, skipped };
}

module.exports = { enqueueStopArrivalAlerts, thresholdPlan };
