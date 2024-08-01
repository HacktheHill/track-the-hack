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
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

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
CREATE TABLE `VerificationToken` (
    `identifier` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VerificationToken_token_key`(`token`),
    UNIQUE INDEX `VerificationToken_identifier_token_key`(`identifier`, `token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `image` VARCHAR(191) NULL,
    `emailVerified` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `name` ENUM('ADMIN', 'HACKER', 'ORGANIZER', 'SPONSOR') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Role_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Hacker` (
    `id` VARCHAR(191) NOT NULL,
    `preferredLanguage` ENUM('EN', 'FR') NOT NULL,
    `firstName` VARCHAR(191) NOT NULL,
    `lastName` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phoneNumber` VARCHAR(191) NOT NULL,
    `country` VARCHAR(191) NOT NULL,
    `dateOfBirth` DATETIME(3) NOT NULL,
    `gender` VARCHAR(191) NULL,
    `pronouns` VARCHAR(191) NULL,
    `raceEthnicity` VARCHAR(191) NULL,
    `currentSchoolOrganization` VARCHAR(191) NOT NULL,
    `educationLevel` VARCHAR(191) NOT NULL,
    `major` VARCHAR(191) NOT NULL,
    `linkedin` VARCHAR(191) NULL,
    `github` VARCHAR(191) NULL,
    `personalWebsite` VARCHAR(191) NULL,
    `hackathonBefore` BOOLEAN NOT NULL,
    `hackathonDetails` VARCHAR(191) NOT NULL,
    `programmingLanguagesTechnologies` VARCHAR(191) NOT NULL,
    `projectDescription` VARCHAR(191) NOT NULL,
    `participationReason` VARCHAR(191) NOT NULL,
    `learningGoals` VARCHAR(191) NOT NULL,
    `emergencyContactName` VARCHAR(191) NOT NULL,
    `emergencyContactRelation` VARCHAR(191) NOT NULL,
    `emergencyContactPhoneNumber` VARCHAR(191) NOT NULL,
    `tShirtSize` ENUM('XS', 'S', 'M', 'L', 'XL', 'XXL') NOT NULL,
    `dietaryRestrictions` VARCHAR(191) NOT NULL,
    `specialAccommodations` VARCHAR(191) NULL,
    `additionalInfo` VARCHAR(191) NULL,
    `travelOrigin` VARCHAR(191) NULL,
    `travelAccommodations` ENUM('GTA', 'MONTREAL', 'WATERLOO', 'NONE') NULL,
    `referralSource` VARCHAR(191) NULL,
    `hthAgreements` BOOLEAN NOT NULL,
    `hthPromotions` BOOLEAN NOT NULL,
    `mlhCodeOfConduct` BOOLEAN NOT NULL,
    `mlhPrivacyTerms` BOOLEAN NOT NULL,
    `mlhPromotions` BOOLEAN NOT NULL,
    `hasResume` BOOLEAN NOT NULL DEFAULT false,
    `applicationStatus` ENUM('PENDING', 'ACCEPTED', 'WAITLISTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `confirmed` BOOLEAN NOT NULL DEFAULT false,
    `unsubscribed` BOOLEAN NOT NULL DEFAULT false,
    `unsubscribeToken` VARCHAR(191) NULL,
    `acceptanceExpiry` DATETIME(3) NULL,
    `walkIn` BOOLEAN NOT NULL DEFAULT false,
    `winner` BOOLEAN NOT NULL DEFAULT false,
    `userId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `presenceInfoId` VARCHAR(191) NULL,

    UNIQUE INDEX `Hacker_unsubscribeToken_key`(`unsubscribeToken`),
    UNIQUE INDEX `Hacker_userId_key`(`userId`),
    INDEX `Hacker_userId_idx`(`userId`),
    INDEX `Hacker_presenceInfoId_idx`(`presenceInfoId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Presence` (
    `key` VARCHAR(191) NOT NULL,
    `value` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `hackerId` VARCHAR(191) NULL,

    UNIQUE INDEX `Presence_key_key`(`key`),
    INDEX `Presence_hackerId_idx`(`hackerId`),
    PRIMARY KEY (`key`)
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
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sourceId` VARCHAR(191) NOT NULL,
    `sourceType` VARCHAR(191) NOT NULL,
    `author` VARCHAR(191) NOT NULL DEFAULT '',
    `route` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `details` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,

    INDEX `Log_userId_idx`(`userId`),
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
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Hardware_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_RoleToUser` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_RoleToUser_AB_unique`(`A`, `B`),
    INDEX `_RoleToUser_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_LogToUser` (
    `A` INTEGER NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_LogToUser_AB_unique`(`A`, `B`),
    INDEX `_LogToUser_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

