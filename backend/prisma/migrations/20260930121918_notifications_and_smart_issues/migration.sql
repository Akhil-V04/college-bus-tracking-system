/*
  Warnings:

  - You are about to drop the `ReportEmbedding` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT');

-- CreateEnum
CREATE TYPE "NotificationTargetType" AS ENUM ('GLOBAL', 'ROUTE');

-- AlterTable
ALTER TABLE "Issue" ADD COLUMN     "embeddingArray" DOUBLE PRECISION[],
ADD COLUMN     "modelVersion" TEXT,
ADD COLUMN     "representativeText" TEXT;

-- DropTable
DROP TABLE "ReportEmbedding";

-- CreateTable
CREATE TABLE "AdminNotification" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "targetType" "NotificationTargetType" NOT NULL DEFAULT 'GLOBAL',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "publishedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3),
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNotificationRoute" (
    "id" SERIAL NOT NULL,
    "notificationId" INTEGER NOT NULL,
    "routeServiceId" INTEGER NOT NULL,

    CONSTRAINT "AdminNotificationRoute_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminNotification_status_expiresAt_idx" ON "AdminNotification"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "AdminNotification_targetType_idx" ON "AdminNotification"("targetType");

-- CreateIndex
CREATE INDEX "AdminNotificationRoute_routeServiceId_idx" ON "AdminNotificationRoute"("routeServiceId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminNotificationRoute_notificationId_routeServiceId_key" ON "AdminNotificationRoute"("notificationId", "routeServiceId");

-- AddForeignKey
ALTER TABLE "AdminNotificationRoute" ADD CONSTRAINT "AdminNotificationRoute_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "AdminNotification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
