-- CreateTable
CREATE TABLE `RouteService` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `routeNo` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `areaCovered` TEXT NOT NULL,
    `capacity` INTEGER NOT NULL,
    `driverId` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `RouteService_routeNo_key`(`routeNo`),
    UNIQUE INDEX `RouteService_driverId_key`(`driverId`),
    INDEX `RouteService_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Stop` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Stop_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduleVersion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `routeServiceId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `direction` VARCHAR(191) NOT NULL DEFAULT 'MORNING',
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 1,
    `effectiveFrom` DATETIME(3) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ScheduleVersion_routeServiceId_status_idx`(`routeServiceId`, `status`),
    UNIQUE INDEX `ScheduleVersion_routeServiceId_direction_version_key`(`routeServiceId`, `direction`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ScheduleStop` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scheduleVersionId` INTEGER NOT NULL,
    `stopId` INTEGER NOT NULL,
    `sequenceOrder` INTEGER NOT NULL,
    `scheduledTime` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ScheduleStop_stopId_idx`(`stopId`),
    UNIQUE INDEX `ScheduleStop_scheduleVersionId_stopId_key`(`scheduleVersionId`, `stopId`),
    UNIQUE INDEX `ScheduleStop_scheduleVersionId_sequenceOrder_key`(`scheduleVersionId`, `sequenceOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Driver` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `driverCode` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `licenseNo` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `sessionVersion` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Driver_driverCode_key`(`driverCode`),
    UNIQUE INDEX `Driver_phone_key`(`phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TransportRoster` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `academicYear` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `version` INTEGER NOT NULL DEFAULT 1,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `TransportRoster_status_idx`(`status`),
    UNIQUE INDEX `TransportRoster_academicYear_version_key`(`academicYear`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RosterPassenger` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `rosterId` INTEGER NOT NULL,
    `routeServiceId` INTEGER NOT NULL,
    `boardingStopId` INTEGER NOT NULL,
    `passengerType` ENUM('STUDENT', 'FACULTY') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `busPassId` VARCHAR(191) NOT NULL,
    `rollNo` VARCHAR(191) NULL,
    `facultyId` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `year` INTEGER NULL,
    `section` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RosterPassenger_rosterId_routeServiceId_idx`(`rosterId`, `routeServiceId`),
    INDEX `RosterPassenger_boardingStopId_idx`(`boardingStopId`),
    INDEX `RosterPassenger_passengerType_idx`(`passengerType`),
    INDEX `RosterPassenger_department_year_section_idx`(`department`, `year`, `section`),
    UNIQUE INDEX `RosterPassenger_rosterId_busPassId_key`(`rosterId`, `busPassId`),
    UNIQUE INDEX `RosterPassenger_rosterId_rollNo_key`(`rosterId`, `rollNo`),
    UNIQUE INDEX `RosterPassenger_rosterId_facultyId_key`(`rosterId`, `facultyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClassAdvisor` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `department` VARCHAR(191) NOT NULL,
    `year` INTEGER NOT NULL,
    `section` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ClassAdvisor_email_key`(`email`),
    UNIQUE INDEX `ClassAdvisor_department_year_section_key`(`department`, `year`, `section`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Trip` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `routeServiceId` INTEGER NOT NULL,
    `driverId` INTEGER NOT NULL,
    `rosterId` INTEGER NOT NULL,
    `scheduleVersionId` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `startTime` DATETIME(3) NULL,
    `endTime` DATETIME(3) NULL,
    `status` ENUM('SCHEDULED', 'RUNNING', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'SCHEDULED',
    `currentStopIndex` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Trip_routeServiceId_status_idx`(`routeServiceId`, `status`),
    INDEX `Trip_driverId_status_idx`(`driverId`, `status`),
    INDEX `Trip_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LiveLocation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tripId` INTEGER NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `deviceTimestamp` DATETIME(3) NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acceptedForEta` BOOLEAN NOT NULL DEFAULT true,
    `rejectionReason` VARCHAR(191) NULL,

    INDEX `LiveLocation_tripId_receivedAt_idx`(`tripId`, `receivedAt`),
    INDEX `LiveLocation_tripId_acceptedForEta_receivedAt_idx`(`tripId`, `acceptedForEta`, `receivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TripStopEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tripId` INTEGER NOT NULL,
    `scheduleStopId` INTEGER NOT NULL,
    `status` ENUM('REACHED', 'PASSED', 'POSSIBLY_SKIPPED') NOT NULL,
    `detectedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `latitude` DOUBLE NULL,
    `longitude` DOUBLE NULL,

    INDEX `TripStopEvent_tripId_detectedAt_idx`(`tripId`, `detectedAt`),
    UNIQUE INDEX `TripStopEvent_tripId_scheduleStopId_key`(`tripId`, `scheduleStopId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LateAlert` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tripId` INTEGER NOT NULL,
    `predictedEta` DATETIME(3) NOT NULL,
    `status` ENUM('ACTIVE', 'RECOVERED') NOT NULL DEFAULT 'ACTIVE',
    `triggeredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `recoveredAt` DATETIME(3) NULL,
    `studentsAffected` JSON NOT NULL,
    `advisorsNotified` JSON NOT NULL,
    `previousHash` VARCHAR(191) NULL,
    `recordHash` VARCHAR(191) NULL,

    INDEX `LateAlert_tripId_status_idx`(`tripId`, `status`),
    INDEX `LateAlert_triggeredAt_idx`(`triggeredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NotificationOutbox` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `lateAlertId` INTEGER NOT NULL,
    `recipient` VARCHAR(191) NOT NULL,
    `channel` ENUM('EMAIL') NOT NULL DEFAULT 'EMAIL',
    `payload` JSON NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `lastError` VARCHAR(191) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `NotificationOutbox_status_createdAt_idx`(`status`, `createdAt`),
    INDEX `NotificationOutbox_lateAlertId_idx`(`lateAlertId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminAuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `adminIdentifier` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `beforeSummary` JSON NULL,
    `afterSummary` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminAuditLog_entityType_entityId_idx`(`entityType`, `entityId`),
    INDEX `AdminAuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RouteService` ADD CONSTRAINT `RouteService_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleVersion` ADD CONSTRAINT `ScheduleVersion_routeServiceId_fkey` FOREIGN KEY (`routeServiceId`) REFERENCES `RouteService`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleStop` ADD CONSTRAINT `ScheduleStop_scheduleVersionId_fkey` FOREIGN KEY (`scheduleVersionId`) REFERENCES `ScheduleVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ScheduleStop` ADD CONSTRAINT `ScheduleStop_stopId_fkey` FOREIGN KEY (`stopId`) REFERENCES `Stop`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterPassenger` ADD CONSTRAINT `RosterPassenger_rosterId_fkey` FOREIGN KEY (`rosterId`) REFERENCES `TransportRoster`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterPassenger` ADD CONSTRAINT `RosterPassenger_routeServiceId_fkey` FOREIGN KEY (`routeServiceId`) REFERENCES `RouteService`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RosterPassenger` ADD CONSTRAINT `RosterPassenger_boardingStopId_fkey` FOREIGN KEY (`boardingStopId`) REFERENCES `Stop`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Trip` ADD CONSTRAINT `Trip_routeServiceId_fkey` FOREIGN KEY (`routeServiceId`) REFERENCES `RouteService`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Trip` ADD CONSTRAINT `Trip_driverId_fkey` FOREIGN KEY (`driverId`) REFERENCES `Driver`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Trip` ADD CONSTRAINT `Trip_rosterId_fkey` FOREIGN KEY (`rosterId`) REFERENCES `TransportRoster`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Trip` ADD CONSTRAINT `Trip_scheduleVersionId_fkey` FOREIGN KEY (`scheduleVersionId`) REFERENCES `ScheduleVersion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LiveLocation` ADD CONSTRAINT `LiveLocation_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `Trip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TripStopEvent` ADD CONSTRAINT `TripStopEvent_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `Trip`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TripStopEvent` ADD CONSTRAINT `TripStopEvent_scheduleStopId_fkey` FOREIGN KEY (`scheduleStopId`) REFERENCES `ScheduleStop`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LateAlert` ADD CONSTRAINT `LateAlert_tripId_fkey` FOREIGN KEY (`tripId`) REFERENCES `Trip`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NotificationOutbox` ADD CONSTRAINT `NotificationOutbox_lateAlertId_fkey` FOREIGN KEY (`lateAlertId`) REFERENCES `LateAlert`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
