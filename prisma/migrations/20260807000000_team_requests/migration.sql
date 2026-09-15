-- AlterTable
ALTER TABLE `Team` ADD COLUMN `captainHackerId` VARCHAR(191) NULL;

-- BackfillCaptain
UPDATE `Team` AS `team`
JOIN (
    SELECT `teamId`, MIN(`id`) AS `captainHackerId`
    FROM `Hacker`
    WHERE `teamId` IS NOT NULL
    GROUP BY `teamId`
) AS `members` ON `members`.`teamId` = `team`.`id`
SET `team`.`captainHackerId` = `members`.`captainHackerId`;

-- CreateTable
CREATE TABLE `TeamRequest` (
    `id` VARCHAR(191) NOT NULL,
    `listingDiscordThreadId` VARCHAR(191) NOT NULL,
    `conversationDiscordThreadId` VARCHAR(191) NOT NULL,
    `createdByHackerId` VARCHAR(191) NOT NULL,
    `sourceTeamId` VARCHAR(191) NULL,
    `targetHackerId` VARCHAR(191) NOT NULL,
    `targetTeamId` VARCHAR(191) NULL,
    `requesterRank` INTEGER NULL,
    `ownerRank` INTEGER NULL,
    `status` ENUM('INTERESTED', 'OFFERED', 'ACCEPTED', 'REJECTED', 'DECLINED') NOT NULL DEFAULT 'INTERESTED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `TeamRequest_conversationDiscordThreadId_key`(`conversationDiscordThreadId`),
    INDEX `TeamRequest_createdByHackerId_idx`(`createdByHackerId`),
    INDEX `TeamRequest_sourceTeamId_idx`(`sourceTeamId`),
    INDEX `TeamRequest_targetHackerId_idx`(`targetHackerId`),
    INDEX `TeamRequest_targetTeamId_idx`(`targetTeamId`),
    INDEX `TeamRequest_listingDiscordThreadId_idx`(`listingDiscordThreadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InternalApiRequest` (
    `id` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `InternalApiRequest_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Team_captainHackerId_key` ON `Team`(`captainHackerId`);
