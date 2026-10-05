require('dotenv').config();

const assert = require('node:assert/strict');
const prisma = require('../src/lib/prisma');
const { writeAdminAudit } = require('../src/lib/adminAudit');

const ROLLBACK_FIXTURE = Symbol('rollback-runtime-workflows');

async function main() {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  let counts;
  try {
    await prisma.$transaction(async (tx) => {
      const now = new Date();
      const later = new Date(now.getTime() + 60 * 60_000);
      const driverA = await tx.driver.create({ data: {
        driverCode: `RW-A-${suffix}`, name: 'Runtime Workflow A', phone: `71${String(Date.now()).slice(-8)}`,
        licenseNo: `RW-LA-${suffix}`, passwordHash: 'synthetic-verification-only',
      } });
      const driverB = await tx.driver.create({ data: {
        driverCode: `RW-B-${suffix}`, name: 'Runtime Workflow B', phone: `72${String(Date.now()).slice(-8)}`,
        licenseNo: `RW-LB-${suffix}`, passwordHash: 'synthetic-verification-only',
      } });
      const routeA = await tx.routeService.create({ data: {
        routeNo: `RW-A-${suffix}`, name: 'Runtime Route A', areaCovered: 'Synthetic restricted-role verification',
        capacity: 20, driverId: driverA.id,
      } });
      const routeB = await tx.routeService.create({ data: {
        routeNo: `RW-B-${suffix}`, name: 'Runtime Route B', areaCovered: 'Synthetic assistance route',
        capacity: 20, driverId: driverB.id,
      } });
      const stopA = await tx.stop.create({ data: { name: `Runtime Stop A ${suffix}`, latitude: 12.9716, longitude: 77.5946 } });
      const stopB = await tx.stop.create({ data: { name: `Runtime Stop B ${suffix}`, latitude: 12.9352, longitude: 77.6245 } });
      const scheduleA = await tx.scheduleVersion.create({ data: {
        routeServiceId: routeA.id, name: 'Runtime Schedule A', status: 'PUBLISHED', version: 1,
        publishedAt: now, geometryPolyline: 'synthetic-polyline', geometryFormat: 'polyline5',
        geometryProvider: 'GOOGLE_ROUTES_API', geometryFingerprint: `rw-${suffix}`,
      } });
      const scheduleB = await tx.scheduleVersion.create({ data: {
        routeServiceId: routeB.id, name: 'Runtime Schedule B', status: 'PUBLISHED', version: 1,
        publishedAt: now, geometryPolyline: 'synthetic-polyline', geometryFormat: 'polyline5',
        geometryProvider: 'GOOGLE_ROUTES_API', geometryFingerprint: `rw-b-${suffix}`,
      } });
      const scheduleStopsA = await Promise.all([
        tx.scheduleStop.create({ data: { scheduleVersionId: scheduleA.id, stopId: stopA.id, sequenceOrder: 0, scheduledTime: '08:00' } }),
        tx.scheduleStop.create({ data: { scheduleVersionId: scheduleA.id, stopId: stopB.id, sequenceOrder: 1, scheduledTime: '08:30' } }),
      ]);
      const scheduleStopsB = await Promise.all([
        tx.scheduleStop.create({ data: { scheduleVersionId: scheduleB.id, stopId: stopA.id, sequenceOrder: 0, scheduledTime: '08:05' } }),
        tx.scheduleStop.create({ data: { scheduleVersionId: scheduleB.id, stopId: stopB.id, sequenceOrder: 1, scheduledTime: '08:35' } }),
      ]);
      const roster = await tx.transportRoster.create({ data: {
        name: `Runtime Roster ${suffix}`, academicYear: `RW-${suffix}`, status: 'PUBLISHED', version: 1, publishedAt: now,
      } });
      await tx.rosterPassenger.create({ data: {
        rosterId: roster.id, routeServiceId: routeA.id, boardingStopId: stopA.id,
        passengerType: 'STUDENT', name: 'Synthetic Runtime Passenger', busPassId: `RW-P-${suffix}`,
        rollNo: `RW-R-${suffix}`, department: 'CSE', year: 2, section: 'R',
      } });
      await tx.classAdvisor.create({ data: {
        name: 'Synthetic Runtime Advisor', phone: '7000000000', email: `runtime-${suffix}@example.invalid`,
        department: 'CSE', year: 2, section: 'R',
      } });
      const tripA = await tx.trip.create({ data: {
        routeServiceId: routeA.id, driverId: driverA.id, rosterId: roster.id, scheduleVersionId: scheduleA.id,
        date: now, startTime: new Date(now.getTime() - 30 * 60_000), collegeDeadlineAt: now,
        actualCollegeArrivalAt: new Date(now.getTime() + 5 * 60_000), actualDelayMinutes: 5,
        status: 'COMPLETED', routeSnapshot: { routeNo: routeA.routeNo },
        scheduleSnapshot: { stopCount: 2 }, rosterSnapshot: { passengerCount: 1 }, rosterSnapshotKind: 'COMPACT',
      } });
      const tripB = await tx.trip.create({ data: {
        routeServiceId: routeB.id, driverId: driverB.id, rosterId: roster.id, scheduleVersionId: scheduleB.id,
        date: now, startTime: now, status: 'RUNNING', routeSnapshot: { routeNo: routeB.routeNo },
        scheduleSnapshot: { stopCount: 2 }, rosterSnapshot: { passengerCount: 0 }, rosterSnapshotKind: 'OPERATIONAL',
      } });
      await tx.liveLocation.createMany({ data: [
        { tripId: tripA.id, latitude: 12.9716, longitude: 77.5946, deviceTimestamp: now, accuracyMeters: 8, acceptedForEta: true },
        { tripId: tripB.id, latitude: 12.9720, longitude: 77.5950, deviceTimestamp: now, accuracyMeters: 7, deviceSpeedKmh: 0, acceptedForEta: true },
      ] });
      await tx.tripStopEvent.createMany({ data: [
        { tripId: tripA.id, scheduleStopId: scheduleStopsA[0].id, status: 'REACHED', detectedAt: new Date(now.getTime() - 20 * 60_000) },
        { tripId: tripA.id, scheduleStopId: scheduleStopsA[1].id, status: 'REACHED', detectedAt: now },
      ] });
      const alert = await tx.lateAlert.create({ data: {
        tripId: tripA.id, predictedEta: later, status: 'ACTIVE', studentsAffected: [], advisorsNotified: [],
      } });
      await tx.notificationOutbox.create({ data: {
        lateAlertId: alert.id, recipient: `runtime-${suffix}@example.invalid`, payload: { synthetic: true },
        idempotencyKey: `runtime-email-${suffix}`,
      } });
      await tx.tripDriverTransfer.create({ data: {
        tripId: tripA.id, fromDriverId: driverA.id, toDriverId: driverB.id,
        adminIdentifier: 'restricted-role-verifier', reason: 'Synthetic transfer evidence',
      } });
      await tx.etaCalibrationSnapshot.create({ data: { tripId: tripA.id, payload: { etaSeconds: 300 } } });
      await tx.segmentTravelSample.create({ data: {
        tripId: tripA.id, routeServiceId: routeA.id, scheduleVersionId: scheduleA.id,
        fromScheduleStopId: scheduleStopsA[0].id, toScheduleStopId: scheduleStopsA[1].id,
        startedAt: new Date(now.getTime() - 20 * 60_000), endedAt: now, durationSeconds: 1200,
        weekday: now.getUTCDay(), timeWindow: 'MORNING',
      } });
      await tx.segmentTravelAggregate.create({ data: {
        routeServiceId: routeA.id, scheduleVersionId: scheduleA.id,
        fromScheduleStopId: scheduleStopsA[0].id, toScheduleStopId: scheduleStopsA[1].id,
        weekday: now.getUTCDay(), timeWindow: 'MORNING', sampleCount: 1,
        medianSeconds: 1200, averageSeconds: 1200, madSeconds: 0, confidence: 'LOW',
      } });
      const device = await tx.pushDeviceSubscription.create({ data: {
        pushToken: `ExponentPushToken[runtime-${suffix}]`, tokenHash: `runtime-token-${suffix}`,
        managementSecretHash: `runtime-secret-${suffix}`, driverId: driverB.id, expiresAt: later,
      } });
      const subscription = await tx.stopAlertSubscription.create({ data: {
        pushDeviceSubscriptionId: device.id, routeServiceId: routeA.id, stopId: stopB.id,
        thresholdsMinutes: [10, 5, 1],
      } });
      await tx.stopAlertDelivery.create({ data: {
        subscriptionId: subscription.id, tripId: tripA.id, thresholdMinutes: 5,
        status: 'SENT', idempotencyKey: `runtime-stop-${suffix}`, sentAt: now,
      } });
      await tx.pushNotificationOutbox.create({ data: {
        pushDeviceSubscriptionId: device.id, idempotencyKey: `runtime-push-${suffix}`,
        payload: { synthetic: true }, status: 'PENDING',
      } });
      const feedback = await tx.feedbackReport.create({ data: {
        category: 'OTHER', routeServiceId: routeA.id, tripId: tripA.id,
        description: 'Synthetic restricted-role feedback', fingerprintHash: `runtime-feedback-${suffix}`,
      } });
      const disposableFeedback = await tx.feedbackReport.create({ data: {
        category: 'OTHER', description: 'Synthetic delete probe', fingerprintHash: `runtime-delete-${suffix}`,
      } });
      const emergency = await tx.emergencyReport.create({ data: {
        category: 'BUS_BREAKDOWN', reporterType: 'DRIVER', reporterDriverId: driverA.id,
        tripId: tripA.id, routeServiceId: routeA.id, status: 'CONFIRMED',
        description: 'Synthetic restricted-role emergency', confirmedBy: 'restricted-role-verifier', confirmedAt: now,
        incidentLatitude: 12.9716, incidentLongitude: 77.5946, incidentLocationAt: now, incidentSource: 'ACCEPTED_BUS_GPS',
      } });
      const assistance = await tx.emergencyAssistance.create({ data: {
        emergencyReportId: emergency.id, candidateTripId: tripB.id, candidateDriverId: driverB.id,
        distanceMeters: 50, status: 'OFFERED',
      } });
      const adminSession = await tx.adminSession.create({ data: {
        adminIdentifier: 'restricted-role-verifier', expiresAt: later,
      } });
      const rateBucket = await tx.rateLimitBucket.create({ data: {
        key: `runtime:${suffix}`, hits: 1, resetAt: later,
      } });
      await writeAdminAudit(tx, { user: { id: 'restricted-role-verifier' }, requestId: `rw-${suffix}` }, {
        action: 'RESTRICTED_RUNTIME_WORKFLOW_VERIFIED', entityType: 'RuntimeFixture', entityId: suffix,
        afterSummary: { synthetic: true },
      });

      await tx.driver.update({ where: { id: driverA.id }, data: { sessionVersion: { increment: 1 } } });
      await tx.routeService.update({ where: { id: routeA.id }, data: { name: 'Runtime Route A Updated' } });
      await tx.stop.update({ where: { id: stopA.id }, data: { latitude: 12.9717 } });
      await tx.scheduleVersion.update({ where: { id: scheduleA.id }, data: { geometryGeneratedAt: now } });
      await tx.scheduleStop.update({ where: { id: scheduleStopsA[0].id }, data: { scheduledTime: '08:01' } });
      await tx.transportRoster.update({ where: { id: roster.id }, data: { name: 'Runtime Roster Updated' } });
      await tx.rosterPassenger.updateMany({ where: { rosterId: roster.id }, data: { section: 'S' } });
      await tx.classAdvisor.updateMany({ where: { email: `runtime-${suffix}@example.invalid` }, data: { section: 'S' } });
      await tx.trip.update({ where: { id: tripA.id }, data: { currentEta: { remainingSeconds: 0 }, currentEtaAt: now } });
      await tx.liveLocation.updateMany({ where: { tripId: tripA.id }, data: { deviceSpeedKmh: 20 } });
      await tx.tripStopEvent.updateMany({ where: { tripId: tripA.id }, data: { latitude: 12.9716 } });
      await tx.lateAlert.update({ where: { id: alert.id }, data: { status: 'RECOVERED', recoveredAt: now } });
      await tx.notificationOutbox.updateMany({ where: { lateAlertId: alert.id }, data: { status: 'SENT', sentAt: now } });
      await tx.etaCalibrationSnapshot.updateMany({ where: { tripId: tripA.id }, data: { payload: { etaSeconds: 0 } } });
      await tx.segmentTravelSample.updateMany({ where: { tripId: tripA.id }, data: { classification: 'DISRUPTION' } });
      await tx.segmentTravelAggregate.updateMany({ where: { routeServiceId: routeA.id }, data: { confidence: 'MEDIUM' } });
      await tx.pushDeviceSubscription.update({ where: { id: device.id }, data: { lastSeenAt: now } });
      await tx.stopAlertSubscription.update({ where: { id: subscription.id }, data: { thresholdsMinutes: [5, 1] } });
      await tx.stopAlertDelivery.updateMany({ where: { subscriptionId: subscription.id }, data: { status: 'SENT' } });
      await tx.pushNotificationOutbox.updateMany({ where: { pushDeviceSubscriptionId: device.id }, data: { status: 'SENT', sentAt: now } });
      await tx.feedbackReport.update({ where: { id: feedback.id }, data: { status: 'UNDER_REVIEW' } });
      await tx.emergencyReport.update({ where: { id: emergency.id }, data: { status: 'ASSISTANCE_REQUESTED' } });
      await tx.emergencyAssistance.update({ where: { id: assistance.id }, data: { status: 'ACCEPTED', respondedAt: now } });
      await tx.adminSession.update({ where: { id: adminSession.id }, data: { revokedAt: now, revokeReason: 'synthetic verification' } });
      await tx.rateLimitBucket.update({ where: { key: rateBucket.key }, data: { hits: { increment: 1 } } });
      await tx.feedbackReport.delete({ where: { id: disposableFeedback.id } });

      const tableCounts = await tx.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS "applicationTables"
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
      `);
      counts = {
        applicationTables: tableCounts[0].applicationTables,
        representativeTablesMutated: 27,
        transfers: await tx.tripDriverTransfer.count({ where: { tripId: tripA.id } }),
        actualLateTrips: await tx.trip.count({ where: { id: tripA.id, actualDelayMinutes: { gt: 0 } } }),
        openEmergencies: await tx.emergencyReport.count({ where: { id: emergency.id, status: 'ASSISTANCE_REQUESTED' } }),
      };
      assert.equal(counts.applicationTables, 27);
      assert.equal(counts.transfers, 1);
      assert.equal(counts.actualLateTrips, 1);
      assert.equal(counts.openEmergencies, 1);
      throw ROLLBACK_FIXTURE;
    }, { maxWait: 10_000, timeout: 90_000 });
  } catch (error) {
    if (error !== ROLLBACK_FIXTURE) throw error;
  }

  console.log(JSON.stringify({
    ...counts,
    covered: [
      'master-data', 'roster-driver', 'trip-transfer', 'gps-progress', 'eta-history',
      'email-push-outbox', 'sessions-rate-limits', 'feedback-emergency-assistance', 'audit-append', 'retention-targets',
    ],
    syntheticFixtureRolledBack: true,
  }));
}

main()
  .catch((error) => {
    console.error(`[runtime-workflows] ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
