-- CreateTable
CREATE TABLE `Account` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerAccountId` VARCHAR(191) NOT NULL,
    `refresh_token` TEXT NULL,
    `refresh_token_expires_in` INTEGER NULL,
    `access_token` TEXT NULL,
    `expires_at` INTEGER NULL,
    `token_type` VARCHAR(191) NULL,
    `scope` VARCHAR(191) NULL,
    `id_token` TEXT NULL,
    `session_state` VARCHAR(191) NULL,
    `ext_expires_in` INTEGER NULL,

    INDEX `Account_userId_idx`(`userId`),
    UNIQUE INDEX `Account_provider_providerAccountId_key`(`provider`, `providerAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `sessionToken` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Session_sessionToken_key`(`sessionToken`),
    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `profileImage` VARCHAR(191) NULL,
    `role` ENUM('HACKER', 'ORGANIZER', 'SPONSOR') NOT NULL DEFAULT 'HACKER',
    `emailVerified` DATETIME(3) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VerificationToken` (
    `identifier` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VerificationToken_token_key`(`token`),
    UNIQUE INDEX `VerificationToken_identifier_token_key`(`identifier`, `token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HackerInfo` (
    `submissionID` VARCHAR(191) NOT NULL,
    `preferredLanguage` ENUM('EN', 'FR') NOT NULL DEFAULT 'EN',
    `email` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `gender` VARCHAR(191) NOT NULL DEFAULT 'Prefer not to say',
    `phoneNumber` VARCHAR(191) NOT NULL,
    `university` VARCHAR(191) NULL,
    `studyLevel` VARCHAR(191) NULL,
    `studyProgram` VARCHAR(191) NULL,
    `graduationYear` INTEGER NULL,
    `attendanceType` ENUM('IN_PERSON', 'ONLINE') NOT NULL DEFAULT 'IN_PERSON',
    `attendanceLocation` VARCHAR(191) NULL,
    `transportationRequired` BOOLEAN NOT NULL DEFAULT false,
    `dietaryRestrictions` TEXT NOT NULL,
    `accessibilityRequirements` TEXT NOT NULL,
    `shirtSize` ENUM('S', 'M', 'L', 'XL', 'XXL') NULL,
    `emergencyContactName` VARCHAR(191) NOT NULL,
    `emergencyContactRelationship` VARCHAR(191) NOT NULL,
    `emergencyContactPhoneNumber` VARCHAR(191) NOT NULL,
    `numberOfPreviousHackathons` INTEGER NULL,
    `linkGithub` VARCHAR(191) NULL,
    `linkLinkedin` VARCHAR(191) NULL,
    `linkPersonalSite` VARCHAR(191) NULL,
    `linkResume` TEXT NULL,
    `lookingForwardTo` TEXT NULL,
    `formStartDate` DATETIME(3) NULL,
    `formEndDate` DATETIME(3) NULL,
    `confirmed` BOOLEAN NOT NULL DEFAULT false,
    `userId` VARCHAR(191) NULL,
    `unsubscribed` BOOLEAN NOT NULL DEFAULT false,
    `unsubscribeToken` VARCHAR(191) NULL,
    `onlyOnline` BOOLEAN NOT NULL DEFAULT false,
    `acceptanceExpiry` DATETIME(3) NULL,
    `walkIn` BOOLEAN NOT NULL DEFAULT false,
    `winner` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `HackerInfo_unsubscribeToken_key`(`unsubscribeToken`),
    INDEX `HackerInfo_userId_idx`(`userId`),
    PRIMARY KEY (`submissionID`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PresenceInfo` (
    `id` VARCHAR(191) NOT NULL,
    `checkedIn` BOOLEAN NOT NULL DEFAULT false,
    `snacks1` BOOLEAN NOT NULL DEFAULT false,
    `breakfast1` BOOLEAN NOT NULL DEFAULT false,
    `lunch1` BOOLEAN NOT NULL DEFAULT false,
    `dinner1` BOOLEAN NOT NULL DEFAULT false,
    `snacks2` BOOLEAN NOT NULL DEFAULT false,
    `breakfast2` BOOLEAN NOT NULL DEFAULT false,
    `lunch2` BOOLEAN NOT NULL DEFAULT false,
    `redbull` BOOLEAN NOT NULL DEFAULT false,
    `hackerInfoId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `PresenceInfo_hackerInfoId_key`(`hackerInfoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Event` (
    `id` VARCHAR(191) NOT NULL,
    `start` DATETIME(3) NOT NULL,
    `end` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('ALL', 'WORKSHOP', 'SOCIAL', 'CAREER_FAIR', 'FOOD') NOT NULL DEFAULT 'ALL',
    `host` VARCHAR(191) NULL,
    `description` TEXT NOT NULL,
    `room` VARCHAR(191) NOT NULL,
    `tiktok` VARCHAR(191) NULL,
    `image` VARCHAR(191) NULL,
    `link` VARCHAR(191) NULL,
    `linkText` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Follow` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Follow_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `user_id` VARCHAR(191) NOT NULL,
    `author` VARCHAR(191) NOT NULL DEFAULT '',
    `route` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `details` VARCHAR(191) NULL,

    INDEX `AuditLog_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payment` (
    `id` VARCHAR(191) NOT NULL,
    `company_name` VARCHAR(191) NOT NULL,
    `reps_name` VARCHAR(191) NOT NULL,
    `amount` INTEGER NOT NULL,
    `tier` ENUM('STARTUP', 'MAYOR', 'PREMIER', 'GOVERNOR', 'PRIME_MINISTER', 'CUSTOM') NOT NULL,
    `logo` VARCHAR(191) NOT NULL,
    `paid` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `invoice` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Link` (
    `id` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `link` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Hardware` (
    `id` VARCHAR(191) NOT NULL,
    `imageURL` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `quantityAvailable` INTEGER NULL,
    `manufacturer` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `type` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,

    INDEX `Hardware_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_AuditLogToUser` (
    `A` INTEGER NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_AuditLogToUser_AB_unique`(`A`, `B`),
    INDEX `_AuditLogToUser_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
