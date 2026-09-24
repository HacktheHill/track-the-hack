CREATE TABLE `NotificationPreference` (
    `hackerId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `discordEnabled` BOOLEAN NOT NULL DEFAULT true,
    `pushEnabled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`hackerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ParticipantPushSubscription` (
    `hackerId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `endpoint` VARCHAR(512) NOT NULL,
    `p256dh` VARCHAR(191) NOT NULL,
    `auth` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(2) NOT NULL DEFAULT 'en',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `ParticipantPushSubscription_endpoint_key`(`endpoint`),
    PRIMARY KEY (`hackerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ParticipantEventReminder` (
    `hackerId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `pushCompletedAt` DATETIME(3) NULL,
    `discordCompletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `ParticipantEventReminder_eventId_idx`(`eventId`),
    PRIMARY KEY (`hackerId`, `eventId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `NotificationCampaign` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `maximumCohortSize` INTEGER NOT NULL,
    `seed` VARCHAR(191) NOT NULL,
    `snapshotAt` DATETIME(3) NOT NULL,
    `snapshotCount` INTEGER NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'LOCKED', 'COMPLETED') NOT NULL DEFAULT 'DRAFT',
    `archivedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `NotificationCampaign_createdAt_idx`(`createdAt`),
    INDEX `NotificationCampaign_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `NotificationCohort` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `ordinal` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `NotificationCohort_campaignId_ordinal_key`(`campaignId`, `ordinal`),
    INDEX `NotificationCohort_campaignId_idx`(`campaignId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `NotificationCohortMember` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `cohortId` VARCHAR(191) NOT NULL,
    `hackerId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `position` INTEGER NOT NULL,
    `dietaryPriority` BOOLEAN NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `NotificationCohortMember_campaignId_hackerId_key`(`campaignId`, `hackerId`),
    UNIQUE INDEX `NotificationCohortMember_cohortId_position_key`(`cohortId`, `position`),
    INDEX `NotificationCohortMember_cohortId_idx`(`cohortId`),
    INDEX `NotificationCohortMember_hackerId_idx`(`hackerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `NotificationAnnouncement` (
    `id` VARCHAR(191) NOT NULL,
    `cohortId` VARCHAR(191) NOT NULL,
    `body` VARCHAR(500) NOT NULL,
    `contentHash` CHAR(64) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,
    UNIQUE INDEX `NotificationAnnouncement_cohortId_key`(`cohortId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `NotificationDelivery` (
    `id` VARCHAR(191) NOT NULL,
    `announcementId` VARCHAR(191) NOT NULL,
    `hackerId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `channel` ENUM('WEB_PUSH', 'DISCORD') NOT NULL,
    `status` ENUM('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED') NOT NULL DEFAULT 'PENDING',
    `failureCode` VARCHAR(32) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `leaseToken` VARCHAR(191) NULL,
    `leaseUntil` DATETIME(3) NULL,
    `sentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `NotificationDelivery_announcementId_hackerId_channel_key`(`announcementId`, `hackerId`, `channel`),
    INDEX `NotificationDelivery_status_nextAttemptAt_idx`(`status`, `nextAttemptAt`),
    INDEX `NotificationDelivery_hackerId_idx`(`hackerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
