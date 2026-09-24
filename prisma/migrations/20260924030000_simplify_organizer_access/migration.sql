-- Replace the legacy role hierarchy with explicit organiser access and one
-- administrator flag. Existing administrators are preserved before the role
-- tables are removed.

ALTER TABLE `User`
    ADD COLUMN `isAdmin` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `disabledAt` DATETIME(3) NULL;

UPDATE `User` AS u
INNER JOIN `_RoleToUser` AS ru ON ru.`B` = u.`id`
INNER JOIN `Role` AS r ON r.`id` = ru.`A`
SET u.`isAdmin` = true
WHERE r.`name` = 'ADMIN';

CREATE TABLE `VerificationToken` (
    `identifier` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VerificationToken_token_key`(`token`),
    UNIQUE INDEX `VerificationToken_identifier_token_key`(`identifier`, `token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrganizerAccess` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `OrganizerAccess_email_key`(`email`),
    INDEX `OrganizerAccess_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `OrganizerPresence` (
    `id` VARCHAR(191) NOT NULL,
    `value` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `organizerId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `OrganizerPresence_organizerId_eventId_key`(`organizerId`, `eventId`),
    INDEX `OrganizerPresence_eventId_idx`(`eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

DROP TABLE `_RoleToUser`;
DROP TABLE `Role`;
