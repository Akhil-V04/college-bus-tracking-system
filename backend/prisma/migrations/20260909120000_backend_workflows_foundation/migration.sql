-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "SegmentSampleClassification" AS ENUM ('NORMAL', 'DISRUPTION');

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('ANDROID', 'IOS');

-- CreateEnum
CREATE TYPE "PushDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "FeedbackCategory" AS ENUM ('DRIVER_BEHAVIOUR', 'DRIVING', 'BUS_CONDITION', 'ROUTE_STOP_ISSUE', 'SCHEDULE_ISSUE', 'APP_ISSUE', 'OTHER');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "EmergencyCategory" AS ENUM ('BUS_BREAKDOWN', 'ACCIDENT');

-- CreateEnum
CREATE TYPE "EmergencyReporterType" AS ENUM ('PASSENGER', 'DRIVER', 'ADMIN');

-- CreateEnum
CREATE TYPE "EmergencyStatus" AS ENUM ('UNVERIFIED', 'CONFIRMED', 'ASSISTANCE_REQUESTED', 'ASSISTANCE_ACCEPTED', 'RESOLVED', 'CANCELLED', 'FALSE_REPORT');

-- CreateEnum
CREATE TYPE "AssistanceStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'DECLINED', 'CLOSED');

-- AlterTable
ALTER TABLE "AdminAuditLog" ADD COLUMN     "correlationId" TEXT,
ADD COLUMN     "previousHash" TEXT,
ADD COLUMN     "recordHash" TEXT;

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "deactivatedAt" TIMESTAMPTZ(3),
ADD COLUMN     "deactivationReason" TEXT,
ADD COLUMN     "status" "DriverStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "ScheduleVersion" ADD COLUMN     "geometryDistanceMeters" DOUBLE PRECISION,
ADD COLUMN     "geometryDurationSeconds" DOUBLE PRECISION,
ADD COLUMN     "geometryErrorCode" TEXT,
ADD COLUMN     "geometryFingerprint" TEXT,
ADD COLUMN     "geometryFormat" TEXT,
ADD COLUMN     "geometryGeneratedAt" TIMESTAMPTZ(3),
ADD COLUMN     "geometryPolyline" TEXT,
ADD COLUMN     "geometryProvider" TEXT;

-- AlterTable
ALTER TABLE "TransportRoster" ADD COLUMN     "passengersPurgedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Trip" ADD COLUMN     "actualCollegeArrivalAt" TIMESTAMPTZ(3),
ADD COLUMN     "actualDelayMinutes" INTEGER,
ADD COLUMN     "collegeDeadlineAt" TIMESTAMPTZ(3),
ADD COLUMN     "currentEta" JSONB,
ADD COLUMN     "currentEtaAt" TIMESTAMPTZ(3),
ADD COLUMN     "rosterSnapshot" JSONB,
ADD COLUMN     "rosterSnapshotKind" TEXT,
ADD COLUMN     "routeSnapshot" JSONB,
ADD COLUMN     "scheduleSnapshot" JSONB,
ADD COLUMN     "segmentAggregatedAt" TIMESTAMPTZ(3),
ADD COLUMN     "snapshotCapturedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "TripDriverTransfer" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "fromDriverId" INTEGER NOT NULL,
    "toDriverId" INTEGER NOT NULL,
    "adminIdentifier" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripDriverTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtaCalibrationSnapshot" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "calculatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB NOT NULL,

    CONSTRAINT "EtaCalibrationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SegmentTravelSample" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "routeServiceId" INTEGER NOT NULL,
    "scheduleVersionId" INTEGER NOT NULL,
    "fromScheduleStopId" INTEGER NOT NULL,
    "toScheduleStopId" INTEGER NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endedAt" TIMESTAMPTZ(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "weekday" INTEGER NOT NULL,
    "timeWindow" TEXT NOT NULL,
    "classification" "SegmentSampleClassification" NOT NULL DEFAULT 'NORMAL',
    "deviationScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SegmentTravelSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SegmentTravelAggregate" (
    "id" SERIAL NOT NULL,
    "routeServiceId" INTEGER NOT NULL,
    "scheduleVersionId" INTEGER NOT NULL,
    "fromScheduleStopId" INTEGER NOT NULL,
    "toScheduleStopId" INTEGER NOT NULL,
    "weekday" INTEGER NOT NULL,
    "timeWindow" TEXT NOT NULL,
    "sampleCount" INTEGER NOT NULL,
    "medianSeconds" DOUBLE PRECISION NOT NULL,
    "averageSeconds" DOUBLE PRECISION,
    "madSeconds" DOUBLE PRECISION,
    "confidence" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SegmentTravelAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushDeviceSubscription" (
    "id" UUID NOT NULL,
    "pushToken" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "managementSecretHash" TEXT NOT NULL,
    "platform" "PushPlatform" NOT NULL DEFAULT 'ANDROID',
    "driverId" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PushDeviceSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StopAlertSubscription" (
    "id" UUID NOT NULL,
    "pushDeviceSubscriptionId" UUID NOT NULL,
    "routeServiceId" INTEGER NOT NULL,
    "stopId" INTEGER NOT NULL,
    "thresholdsMinutes" INTEGER[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "StopAlertSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StopAlertDelivery" (
    "id" SERIAL NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "tripId" INTEGER NOT NULL,
    "thresholdMinutes" INTEGER NOT NULL,
    "status" "PushDeliveryStatus" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMPTZ(3),

    CONSTRAINT "StopAlertDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushNotificationOutbox" (
    "id" SERIAL NOT NULL,
    "pushDeviceSubscriptionId" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "PushDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastAttemptAt" TIMESTAMPTZ(3),
    "lastError" TEXT,
    "providerReceiptId" TEXT,
    "sentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "PushNotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackReport" (
    "id" UUID NOT NULL,
    "category" "FeedbackCategory" NOT NULL,
    "routeServiceId" INTEGER,
    "tripId" INTEGER,
    "description" TEXT NOT NULL,
    "additionalInfo" TEXT,
    "fingerprintHash" TEXT NOT NULL,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "resolvedAt" TIMESTAMPTZ(3),

    CONSTRAINT "FeedbackReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyReport" (
    "id" UUID NOT NULL,
    "category" "EmergencyCategory" NOT NULL,
    "reporterType" "EmergencyReporterType" NOT NULL,
    "reporterDriverId" INTEGER,
    "tripId" INTEGER NOT NULL,
    "routeServiceId" INTEGER NOT NULL,
    "status" "EmergencyStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "description" TEXT,
    "incidentLatitude" DOUBLE PRECISION,
    "incidentLongitude" DOUBLE PRECISION,
    "incidentLocationAt" TIMESTAMPTZ(3),
    "incidentSource" TEXT,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMPTZ(3),
    "resolvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EmergencyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyAssistance" (
    "id" UUID NOT NULL,
    "emergencyReportId" UUID NOT NULL,
    "candidateTripId" INTEGER NOT NULL,
    "candidateDriverId" INTEGER NOT NULL,
    "distanceMeters" DOUBLE PRECISION,
    "status" "AssistanceStatus" NOT NULL DEFAULT 'OFFERED',
    "respondedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "EmergencyAssistance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripDriverTransfer_tripId_createdAt_idx" ON "TripDriverTransfer"("tripId", "createdAt");

-- CreateIndex
CREATE INDEX "TripDriverTransfer_fromDriverId_idx" ON "TripDriverTransfer"("fromDriverId");

-- CreateIndex
CREATE INDEX "TripDriverTransfer_toDriverId_idx" ON "TripDriverTransfer"("toDriverId");

-- CreateIndex
CREATE INDEX "EtaCalibrationSnapshot_calculatedAt_idx" ON "EtaCalibrationSnapshot"("calculatedAt");

-- CreateIndex
CREATE INDEX "EtaCalibrationSnapshot_tripId_calculatedAt_idx" ON "EtaCalibrationSnapshot"("tripId", "calculatedAt");

-- CreateIndex
CREATE INDEX "SegmentTravelSample_routeServiceId_weekday_timeWindow_idx" ON "SegmentTravelSample"("routeServiceId", "weekday", "timeWindow");

-- CreateIndex
CREATE UNIQUE INDEX "SegmentTravelSample_tripId_fromScheduleStopId_toScheduleSto_key" ON "SegmentTravelSample"("tripId", "fromScheduleStopId", "toScheduleStopId");

-- CreateIndex
CREATE INDEX "SegmentTravelAggregate_routeServiceId_weekday_timeWindow_idx" ON "SegmentTravelAggregate"("routeServiceId", "weekday", "timeWindow");

-- CreateIndex
CREATE UNIQUE INDEX "SegmentTravelAggregate_routeServiceId_scheduleVersionId_fro_key" ON "SegmentTravelAggregate"("routeServiceId", "scheduleVersionId", "fromScheduleStopId", "toScheduleStopId", "weekday", "timeWindow");

-- CreateIndex
CREATE UNIQUE INDEX "PushDeviceSubscription_pushToken_key" ON "PushDeviceSubscription"("pushToken");

-- CreateIndex
CREATE UNIQUE INDEX "PushDeviceSubscription_tokenHash_key" ON "PushDeviceSubscription"("tokenHash");

-- CreateIndex
CREATE INDEX "PushDeviceSubscription_active_expiresAt_idx" ON "PushDeviceSubscription"("active", "expiresAt");

-- CreateIndex
CREATE INDEX "PushDeviceSubscription_driverId_idx" ON "PushDeviceSubscription"("driverId");

-- CreateIndex
CREATE INDEX "StopAlertSubscription_routeServiceId_stopId_active_idx" ON "StopAlertSubscription"("routeServiceId", "stopId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "StopAlertSubscription_pushDeviceSubscriptionId_routeService_key" ON "StopAlertSubscription"("pushDeviceSubscriptionId", "routeServiceId", "stopId");

-- CreateIndex
CREATE UNIQUE INDEX "StopAlertDelivery_idempotencyKey_key" ON "StopAlertDelivery"("idempotencyKey");

-- CreateIndex
CREATE INDEX "StopAlertDelivery_tripId_status_idx" ON "StopAlertDelivery"("tripId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StopAlertDelivery_subscriptionId_tripId_thresholdMinutes_key" ON "StopAlertDelivery"("subscriptionId", "tripId", "thresholdMinutes");

-- CreateIndex
CREATE UNIQUE INDEX "PushNotificationOutbox_idempotencyKey_key" ON "PushNotificationOutbox"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PushNotificationOutbox_status_nextAttemptAt_idx" ON "PushNotificationOutbox"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "FeedbackReport_status_createdAt_idx" ON "FeedbackReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackReport_fingerprintHash_createdAt_idx" ON "FeedbackReport"("fingerprintHash", "createdAt");

-- CreateIndex
CREATE INDEX "EmergencyReport_status_createdAt_idx" ON "EmergencyReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "EmergencyReport_tripId_status_idx" ON "EmergencyReport"("tripId", "status");

-- CreateIndex
CREATE INDEX "EmergencyAssistance_candidateDriverId_status_idx" ON "EmergencyAssistance"("candidateDriverId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EmergencyAssistance_emergencyReportId_candidateDriverId_key" ON "EmergencyAssistance"("emergencyReportId", "candidateDriverId");

-- At most one driver may hold the accepted assignment for an emergency.
CREATE UNIQUE INDEX "EmergencyAssistance_one_accepted_per_emergency_key"
ON "EmergencyAssistance"("emergencyReportId")
WHERE "status" = 'ACCEPTED';

-- Threshold sets are required and must contain only the supported values.
ALTER TABLE "StopAlertSubscription"
  ALTER COLUMN "thresholdsMinutes" SET DEFAULT ARRAY[]::INTEGER[],
  ALTER COLUMN "thresholdsMinutes" SET NOT NULL,
  ADD CONSTRAINT "StopAlertSubscription_thresholds_check"
    CHECK ("thresholdsMinutes" <@ ARRAY[1, 5, 10]::INTEGER[]);

ALTER TABLE "SegmentTravelSample"
  ADD CONSTRAINT "SegmentTravelSample_duration_check" CHECK ("durationSeconds" > 0),
  ADD CONSTRAINT "SegmentTravelSample_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6);

ALTER TABLE "SegmentTravelAggregate"
  ADD CONSTRAINT "SegmentTravelAggregate_sample_count_check" CHECK ("sampleCount" > 0),
  ADD CONSTRAINT "SegmentTravelAggregate_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6);

-- AddForeignKey
ALTER TABLE "TripDriverTransfer" ADD CONSTRAINT "TripDriverTransfer_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripDriverTransfer" ADD CONSTRAINT "TripDriverTransfer_fromDriverId_fkey" FOREIGN KEY ("fromDriverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripDriverTransfer" ADD CONSTRAINT "TripDriverTransfer_toDriverId_fkey" FOREIGN KEY ("toDriverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtaCalibrationSnapshot" ADD CONSTRAINT "EtaCalibrationSnapshot_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentTravelSample" ADD CONSTRAINT "SegmentTravelSample_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentTravelSample" ADD CONSTRAINT "SegmentTravelSample_routeServiceId_fkey" FOREIGN KEY ("routeServiceId") REFERENCES "RouteService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentTravelSample" ADD CONSTRAINT "SegmentTravelSample_scheduleVersionId_fkey" FOREIGN KEY ("scheduleVersionId") REFERENCES "ScheduleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentTravelSample" ADD CONSTRAINT "SegmentTravelSample_fromScheduleStopId_fkey" FOREIGN KEY ("fromScheduleStopId") REFERENCES "ScheduleStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentTravelSample" ADD CONSTRAINT "SegmentTravelSample_toScheduleStopId_fkey" FOREIGN KEY ("toScheduleStopId") REFERENCES "ScheduleStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentTravelAggregate" ADD CONSTRAINT "SegmentTravelAggregate_routeServiceId_fkey" FOREIGN KEY ("routeServiceId") REFERENCES "RouteService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentTravelAggregate" ADD CONSTRAINT "SegmentTravelAggregate_scheduleVersionId_fkey" FOREIGN KEY ("scheduleVersionId") REFERENCES "ScheduleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentTravelAggregate" ADD CONSTRAINT "SegmentTravelAggregate_fromScheduleStopId_fkey" FOREIGN KEY ("fromScheduleStopId") REFERENCES "ScheduleStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SegmentTravelAggregate" ADD CONSTRAINT "SegmentTravelAggregate_toScheduleStopId_fkey" FOREIGN KEY ("toScheduleStopId") REFERENCES "ScheduleStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushDeviceSubscription" ADD CONSTRAINT "PushDeviceSubscription_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StopAlertSubscription" ADD CONSTRAINT "StopAlertSubscription_pushDeviceSubscriptionId_fkey" FOREIGN KEY ("pushDeviceSubscriptionId") REFERENCES "PushDeviceSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StopAlertSubscription" ADD CONSTRAINT "StopAlertSubscription_routeServiceId_fkey" FOREIGN KEY ("routeServiceId") REFERENCES "RouteService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StopAlertSubscription" ADD CONSTRAINT "StopAlertSubscription_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "Stop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StopAlertDelivery" ADD CONSTRAINT "StopAlertDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "StopAlertSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StopAlertDelivery" ADD CONSTRAINT "StopAlertDelivery_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushNotificationOutbox" ADD CONSTRAINT "PushNotificationOutbox_pushDeviceSubscriptionId_fkey" FOREIGN KEY ("pushDeviceSubscriptionId") REFERENCES "PushDeviceSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_routeServiceId_fkey" FOREIGN KEY ("routeServiceId") REFERENCES "RouteService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackReport" ADD CONSTRAINT "FeedbackReport_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyReport" ADD CONSTRAINT "EmergencyReport_reporterDriverId_fkey" FOREIGN KEY ("reporterDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyReport" ADD CONSTRAINT "EmergencyReport_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyReport" ADD CONSTRAINT "EmergencyReport_routeServiceId_fkey" FOREIGN KEY ("routeServiceId") REFERENCES "RouteService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAssistance" ADD CONSTRAINT "EmergencyAssistance_emergencyReportId_fkey" FOREIGN KEY ("emergencyReportId") REFERENCES "EmergencyReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAssistance" ADD CONSTRAINT "EmergencyAssistance_candidateTripId_fkey" FOREIGN KEY ("candidateTripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyAssistance" ADD CONSTRAINT "EmergencyAssistance_candidateDriverId_fkey" FOREIGN KEY ("candidateDriverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Supabase is used through the private PostgreSQL connection. Block accidental
-- Data API access even if the project's automatic-exposure setting changes.
ALTER TABLE "RouteService" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Stop" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduleVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScheduleStop" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Driver" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RateLimitBucket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TransportRoster" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RosterPassenger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClassAdvisor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Trip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LiveLocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripStopEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LateAlert" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationOutbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AdminAuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TripDriverTransfer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EtaCalibrationSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SegmentTravelSample" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SegmentTravelAggregate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PushDeviceSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StopAlertSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StopAlertDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PushNotificationOutbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FeedbackReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmergencyReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmergencyAssistance" ENABLE ROW LEVEL SECURITY;

DO $block$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated';
  END IF;
END
$block$;

CREATE SCHEMA IF NOT EXISTS internal;
CREATE OR REPLACE FUNCTION internal.prevent_admin_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
BEGIN
  RAISE EXCEPTION 'AdminAuditLog is append-only';
END
$function$;
REVOKE ALL ON FUNCTION internal.prevent_admin_audit_mutation() FROM PUBLIC;

CREATE TRIGGER "AdminAuditLog_append_only"
BEFORE UPDATE OR DELETE ON "AdminAuditLog"
FOR EACH ROW EXECUTE FUNCTION internal.prevent_admin_audit_mutation();
