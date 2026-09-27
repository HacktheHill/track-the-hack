CREATE TABLE `JudgingRound` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `state` ENUM('DRAFT', 'OPEN', 'LOCKED') NOT NULL DEFAULT 'DRAFT',
    `rubricVersion` INTEGER NOT NULL DEFAULT 1,
    `rubricSnapshot` JSON NOT NULL,
    `assignmentVersion` INTEGER NOT NULL DEFAULT 0,
    `preferredProjectLimit` INTEGER NOT NULL DEFAULT 15,
    `effectiveProjectLimit` INTEGER NOT NULL DEFAULT 15,
    `generationWarnings` JSON NOT NULL,
    `overloadApprovedAt` DATETIME(3) NULL,
    `assignmentsPublishedAt` DATETIME(3) NULL,
    `openedAt` DATETIME(3) NULL,
    `lockedAt` DATETIME(3) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `JudgingRound_state_createdAt_idx`(`state`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `JudgingProject` (
    `id` VARCHAR(191) NOT NULL,
    `roundId` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `tableNumber` INTEGER NOT NULL,
    `room` VARCHAR(191) NOT NULL,
    `devpostUrl` VARCHAR(512) NOT NULL,
    `mainTrack` ENUM('GENERAL', 'CIVIC', 'CGI') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `JudgingProject_roundId_externalId_key`(`roundId`, `externalId`),
    UNIQUE INDEX `JudgingProject_roundId_tableNumber_key`(`roundId`, `tableNumber`),
    INDEX `JudgingProject_roundId_room_tableNumber_idx`(`roundId`, `room`, `tableNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `JudgingProjectCategory` (
    `id` VARCHAR(191) NOT NULL,
    `roundId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `eligibilityResolution` ENUM('ELIGIBLE', 'UNSURE', 'INELIGIBLE') NULL,
    `eligibilityResolvedById` VARCHAR(191) NULL,
    `eligibilityResolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `JudgingProjectCategory_projectId_code_key`(`projectId`, `code`),
    INDEX `JudgingProjectCategory_roundId_code_idx`(`roundId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `JudgingJudge` (
    `id` VARCHAR(191) NOT NULL,
    `roundId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `expertise` JSON NOT NULL,
    `exclusions` JSON NOT NULL,
    `lastSyncAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `JudgingJudge_roundId_email_key`(`roundId`, `email`),
    INDEX `JudgingJudge_email_roundId_idx`(`email`, `roundId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `JudgingAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `roundId` VARCHAR(191) NOT NULL,
    `judgeId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `categoryCode` VARCHAR(191) NOT NULL,
    `isMain` BOOLEAN NOT NULL DEFAULT false,
    `expertiseMatch` BOOLEAN NOT NULL DEFAULT false,
    `calibrationAnchor` BOOLEAN NOT NULL DEFAULT false,
    `assignmentReason` VARCHAR(191) NOT NULL,
    `technicalLevel` INTEGER NULL,
    `ideaLevel` INTEGER NULL,
    `designLevel` INTEGER NULL,
    `learningLevel` INTEGER NULL,
    `presentationLevel` INTEGER NULL,
    `miniEligibility` ENUM('ELIGIBLE', 'UNSURE', 'INELIGIBLE') NULL,
    `miniScore` INTEGER NULL,
    `note` TEXT NULL,
    `rulesConcern` BOOLEAN NOT NULL DEFAULT false,
    `recusedAt` DATETIME(3) NULL,
    `recusalReason` TEXT NULL,
    `recusalAcceptedAt` DATETIME(3) NULL,
    `fieldTimestamps` JSON NOT NULL,
    `fieldOperationIds` JSON NOT NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `JudgingAssignment_judgeId_projectId_categoryCode_key`(`judgeId`, `projectId`, `categoryCode`),
    INDEX `JudgingAssignment_roundId_categoryCode_idx`(`roundId`, `categoryCode`),
    INDEX `JudgingAssignment_projectId_categoryCode_idx`(`projectId`, `categoryCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `JudgingRanking` (
    `id` VARCHAR(191) NOT NULL,
    `roundId` VARCHAR(191) NOT NULL,
    `judgeId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `categoryCode` VARCHAR(191) NOT NULL,
    `rank` INTEGER NOT NULL,
    `editedAt` DATETIME(3) NOT NULL,
    `operationId` VARCHAR(191) NOT NULL,
    `confirmedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `JudgingRanking_judgeId_categoryCode_projectId_key`(`judgeId`, `categoryCode`, `projectId`),
    UNIQUE INDEX `JudgingRanking_judgeId_categoryCode_rank_key`(`judgeId`, `categoryCode`, `rank`),
    INDEX `JudgingRanking_roundId_categoryCode_idx`(`roundId`, `categoryCode`),
    INDEX `JudgingRanking_projectId_categoryCode_idx`(`projectId`, `categoryCode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `JudgingSyncReceipt` (
    `operationId` VARCHAR(191) NOT NULL,
    `roundId` VARCHAR(191) NOT NULL,
    `judgeId` VARCHAR(191) NOT NULL,
    `discarded` BOOLEAN NOT NULL DEFAULT false,
    `clientTimestamps` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `JudgingSyncReceipt_judgeId_createdAt_idx`(`judgeId`, `createdAt`),
    INDEX `JudgingSyncReceipt_roundId_createdAt_idx`(`roundId`, `createdAt`),
    PRIMARY KEY (`operationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
