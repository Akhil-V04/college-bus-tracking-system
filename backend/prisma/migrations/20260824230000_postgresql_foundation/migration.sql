-- CreateEnum
CREATE TYPE "PassengerType" AS ENUM ('STUDENT', 'FACULTY');

-- CreateEnum
CREATE TYPE "RosterStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StopEventStatus" AS ENUM ('REACHED', 'PASSED', 'POSSIBLY_SKIPPED');

-- CreateEnum
CREATE TYPE "LateAlertStatus" AS ENUM ('ACTIVE', 'RECOVERED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "RouteService" (
    "id" SERIAL NOT NULL,
    "routeNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "areaCovered" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "driverId" INTEGER,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RouteService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stop" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Stop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleVersion" (
    "id" SERIAL NOT NULL,
    "routeServiceId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "direction" TEXT NOT NULL DEFAULT 'MORNING',
    "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TIMESTAMPTZ(3),
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ScheduleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleStop" (
    "id" SERIAL NOT NULL,
    "scheduleVersionId" INTEGER NOT NULL,
    "stopId" INTEGER NOT NULL,
    "sequenceOrder" INTEGER NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ScheduleStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" SERIAL NOT NULL,
    "driverCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "licenseNo" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "sessionVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransportRoster" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "status" "RosterStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "TransportRoster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterPassenger" (
    "id" SERIAL NOT NULL,
    "rosterId" INTEGER NOT NULL,
    "routeServiceId" INTEGER NOT NULL,
    "boardingStopId" INTEGER NOT NULL,
    "passengerType" "PassengerType" NOT NULL,
    "name" TEXT NOT NULL,
    "busPassId" TEXT NOT NULL,
    "rollNo" TEXT,
    "facultyId" TEXT,
    "department" TEXT,
    "year" INTEGER,
    "section" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RosterPassenger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassAdvisor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "section" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ClassAdvisor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" SERIAL NOT NULL,
    "routeServiceId" INTEGER NOT NULL,
    "driverId" INTEGER NOT NULL,
    "rosterId" INTEGER NOT NULL,
    "scheduleVersionId" INTEGER NOT NULL,
    "date" TIMESTAMPTZ(3) NOT NULL,
    "startTime" TIMESTAMPTZ(3),
    "endTime" TIMESTAMPTZ(3),
    "status" "TripStatus" NOT NULL DEFAULT 'SCHEDULED',
    "currentStopIndex" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveLocation" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "deviceTimestamp" TIMESTAMPTZ(3),
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedForEta" BOOLEAN NOT NULL DEFAULT true,
    "rejectionReason" TEXT,

    CONSTRAINT "LiveLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripStopEvent" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "scheduleStopId" INTEGER NOT NULL,
    "status" "StopEventStatus" NOT NULL,
    "detectedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "TripStopEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LateAlert" (
    "id" SERIAL NOT NULL,
    "tripId" INTEGER NOT NULL,
    "predictedEta" TIMESTAMPTZ(3) NOT NULL,
    "status" "LateAlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "triggeredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recoveredAt" TIMESTAMPTZ(3),
    "studentsAffected" JSONB NOT NULL,
    "advisorsNotified" JSONB NOT NULL,
    "previousHash" TEXT,
    "recordHash" TEXT,

    CONSTRAINT "LateAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" SERIAL NOT NULL,
    "lateAlertId" INTEGER NOT NULL,
    "recipient" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
    "payload" JSONB NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" SERIAL NOT NULL,
    "adminIdentifier" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeSummary" JSONB,
    "afterSummary" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RouteService_routeNo_key" ON "RouteService"("routeNo");

-- CreateIndex
CREATE UNIQUE INDEX "RouteService_driverId_key" ON "RouteService"("driverId");

-- CreateIndex
CREATE INDEX "RouteService_name_idx" ON "RouteService"("name");

-- CreateIndex
CREATE INDEX "Stop_name_idx" ON "Stop"("name");

-- CreateIndex
CREATE INDEX "ScheduleVersion_routeServiceId_status_idx" ON "ScheduleVersion"("routeServiceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleVersion_routeServiceId_direction_version_key" ON "ScheduleVersion"("routeServiceId", "direction", "version");

-- CreateIndex
CREATE INDEX "ScheduleStop_stopId_idx" ON "ScheduleStop"("stopId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleStop_scheduleVersionId_stopId_key" ON "ScheduleStop"("scheduleVersionId", "stopId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleStop_scheduleVersionId_sequenceOrder_key" ON "ScheduleStop"("scheduleVersionId", "sequenceOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_driverCode_key" ON "Driver"("driverCode");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_phone_key" ON "Driver"("phone");

-- CreateIndex
CREATE INDEX "TransportRoster_status_idx" ON "TransportRoster"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TransportRoster_academicYear_version_key" ON "TransportRoster"("academicYear", "version");

-- CreateIndex
CREATE INDEX "RosterPassenger_rosterId_routeServiceId_idx" ON "RosterPassenger"("rosterId", "routeServiceId");

-- CreateIndex
CREATE INDEX "RosterPassenger_boardingStopId_idx" ON "RosterPassenger"("boardingStopId");

-- CreateIndex
CREATE INDEX "RosterPassenger_passengerType_idx" ON "RosterPassenger"("passengerType");

-- CreateIndex
CREATE INDEX "RosterPassenger_department_year_section_idx" ON "RosterPassenger"("department", "year", "section");

-- CreateIndex
CREATE UNIQUE INDEX "RosterPassenger_rosterId_busPassId_key" ON "RosterPassenger"("rosterId", "busPassId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterPassenger_rosterId_rollNo_key" ON "RosterPassenger"("rosterId", "rollNo");

-- CreateIndex
CREATE UNIQUE INDEX "RosterPassenger_rosterId_facultyId_key" ON "RosterPassenger"("rosterId", "facultyId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassAdvisor_email_key" ON "ClassAdvisor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ClassAdvisor_department_year_section_key" ON "ClassAdvisor"("department", "year", "section");

-- CreateIndex
CREATE INDEX "Trip_routeServiceId_status_idx" ON "Trip"("routeServiceId", "status");

-- CreateIndex
CREATE INDEX "Trip_driverId_status_idx" ON "Trip"("driverId", "status");

-- CreateIndex
CREATE INDEX "Trip_date_idx" ON "Trip"("date");

-- CreateIndex
CREATE INDEX "LiveLocation_tripId_receivedAt_idx" ON "LiveLocation"("tripId", "receivedAt");

-- CreateIndex
CREATE INDEX "LiveLocation_tripId_acceptedForEta_receivedAt_idx" ON "LiveLocation"("tripId", "acceptedForEta", "receivedAt");

-- CreateIndex
CREATE INDEX "TripStopEvent_tripId_detectedAt_idx" ON "TripStopEvent"("tripId", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TripStopEvent_tripId_scheduleStopId_key" ON "TripStopEvent"("tripId", "scheduleStopId");

-- CreateIndex
CREATE INDEX "LateAlert_tripId_status_idx" ON "LateAlert"("tripId", "status");

-- CreateIndex
CREATE INDEX "LateAlert_triggeredAt_idx" ON "LateAlert"("triggeredAt");

-- CreateIndex
CREATE INDEX "NotificationOutbox_status_createdAt_idx" ON "NotificationOutbox"("status", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationOutbox_lateAlertId_idx" ON "NotificationOutbox"("lateAlertId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_entityType_entityId_idx" ON "AdminAuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "RouteService" ADD CONSTRAINT "RouteService_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleVersion" ADD CONSTRAINT "ScheduleVersion_routeServiceId_fkey" FOREIGN KEY ("routeServiceId") REFERENCES "RouteService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleStop" ADD CONSTRAINT "ScheduleStop_scheduleVersionId_fkey" FOREIGN KEY ("scheduleVersionId") REFERENCES "ScheduleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleStop" ADD CONSTRAINT "ScheduleStop_stopId_fkey" FOREIGN KEY ("stopId") REFERENCES "Stop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterPassenger" ADD CONSTRAINT "RosterPassenger_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "TransportRoster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterPassenger" ADD CONSTRAINT "RosterPassenger_routeServiceId_fkey" FOREIGN KEY ("routeServiceId") REFERENCES "RouteService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterPassenger" ADD CONSTRAINT "RosterPassenger_boardingStopId_fkey" FOREIGN KEY ("boardingStopId") REFERENCES "Stop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_routeServiceId_fkey" FOREIGN KEY ("routeServiceId") REFERENCES "RouteService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "TransportRoster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_scheduleVersionId_fkey" FOREIGN KEY ("scheduleVersionId") REFERENCES "ScheduleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveLocation" ADD CONSTRAINT "LiveLocation_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStopEvent" ADD CONSTRAINT "TripStopEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStopEvent" ADD CONSTRAINT "TripStopEvent_scheduleStopId_fkey" FOREIGN KEY ("scheduleStopId") REFERENCES "ScheduleStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LateAlert" ADD CONSTRAINT "LateAlert_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_lateAlertId_fkey" FOREIGN KEY ("lateAlertId") REFERENCES "LateAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PostgreSQL database-level safeguards for values also validated by the API.
ALTER TABLE "RouteService" ADD CONSTRAINT "RouteService_capacity_check" CHECK ("capacity" > 0 AND "capacity" <= 200);
ALTER TABLE "Stop" ADD CONSTRAINT "Stop_latitude_check" CHECK ("latitude" >= -90 AND "latitude" <= 90);
ALTER TABLE "Stop" ADD CONSTRAINT "Stop_longitude_check" CHECK ("longitude" >= -180 AND "longitude" <= 180);
ALTER TABLE "ScheduleStop" ADD CONSTRAINT "ScheduleStop_sequenceOrder_check" CHECK ("sequenceOrder" >= 0);
ALTER TABLE "ClassAdvisor" ADD CONSTRAINT "ClassAdvisor_year_check" CHECK ("year" > 0 AND "year" <= 10);
ALTER TABLE "RosterPassenger" ADD CONSTRAINT "RosterPassenger_year_check" CHECK ("year" IS NULL OR ("year" > 0 AND "year" <= 10));

-- Only one running trip may exist per operational route or driver.
CREATE UNIQUE INDEX "Trip_one_running_per_route" ON "Trip"("routeServiceId") WHERE "status" = 'RUNNING';
CREATE UNIQUE INDEX "Trip_one_running_per_driver" ON "Trip"("driverId") WHERE "status" = 'RUNNING';

-- Small targeted indexes for the operational queues used most often.
CREATE INDEX "NotificationOutbox_actionable_createdAt_idx" ON "NotificationOutbox"("createdAt") WHERE "status" IN ('PENDING', 'FAILED');
CREATE INDEX "LateAlert_active_trip_triggeredAt_idx" ON "LateAlert"("tripId", "triggeredAt") WHERE "status" = 'ACTIVE';