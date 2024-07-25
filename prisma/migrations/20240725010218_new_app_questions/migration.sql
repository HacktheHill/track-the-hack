/*
  Warnings:

  - You are about to drop the column `emailVerified` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `AuditLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `HackerInfo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PresenceInfo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_AuditLogToUser` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE `User` DROP COLUMN `emailVerified`;

-- DropTable
DROP TABLE `AuditLog`;

-- DropTable
DROP TABLE `HackerInfo`;

-- DropTable
DROP TABLE `PresenceInfo`;

-- DropTable
DROP TABLE `_AuditLogToUser`;

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
    `gender` ENUM('MAN', 'WOMAN', 'NON_BINARY', 'OTHER', 'PREFER_NOT_TO_ANSWER') NOT NULL,
    `pronouns` ENUM('HE_HIM', 'SHE_HER', 'THEY_THEM', 'OTHER', 'PREFER_NOT_TO_ANSWER') NOT NULL,
    `raceEthnicity` ENUM('AFRICAN', 'CAUCASIAN', 'EAST_ASIAN', 'SOUTH_ASIAN', 'MIDDLE_EASTERN', 'HISPANIC_LATINO_SPANISH', 'NATIVE_AMERICAN_ALASKAN_NATIVE', 'OTHER', 'PREFER_NOT_TO_ANSWER') NOT NULL,
    `currentSchoolOrganization` VARCHAR(191) NOT NULL,
    `educationLevel` ENUM('HIGH_SCHOOL', 'UNDERGRADUATE', 'GRADUATE', 'OTHER') NOT NULL,
    `major` VARCHAR(191) NOT NULL,
    `linkedin` VARCHAR(191) NULL,
    `github` VARCHAR(191) NULL,
    `personalWebsite` VARCHAR(191) NULL,
    `hackathonBefore` BOOLEAN NOT NULL,
    `hackathonDetails` VARCHAR(191) NULL,
    `programmingLanguagesTechnologies` VARCHAR(191) NOT NULL,
    `projectDescription` VARCHAR(191) NOT NULL,
    `participationReason` VARCHAR(191) NOT NULL,
    `learningGoals` VARCHAR(191) NOT NULL,
    `emergencyContactName` VARCHAR(191) NOT NULL,
    `emergencyContactRelation` VARCHAR(191) NOT NULL,
    `emergencyContactPhoneNumber` VARCHAR(191) NOT NULL,
    `tShirtSize` ENUM('XS', 'S', 'M', 'L', 'XL', 'XXL') NOT NULL,
    `dietaryRestrictions` ENUM('HALAL', 'VEGETARIAN', 'VEGAN', 'KOSHER', 'LACTOSE_INTOLERANCE', 'GLUTEN_FREE', 'NUTS', 'SOY', 'NONE', 'OTHER') NOT NULL,
    `specialAccommodations` VARCHAR(191) NULL,
    `additionalInfo` VARCHAR(191) NULL,
    `travelOrigin` VARCHAR(191) NULL,
    `travelAccommodations` ENUM('GTA', 'MONTREAL', 'WATERLOO', 'NONE') NULL,
    `referralSource` ENUM('STUDENT_ORGANIZATIONS', 'FRIENDS', 'UNIVERSITY_WEBSITE', 'LINKEDIN', 'INSTAGRAM', 'TIKTOK', 'FACEBOOK', 'UNIVERSITY_EMAIL', 'CLASS_ANNOUNCEMENTS', 'HACKATHON_WEBSITES', 'FLYERS', 'PROFESSORS', 'ONLINE_FORUMS', 'ALUMNI_NETWORKS', 'OTHER') NOT NULL,
    `referralOther` VARCHAR(191) NULL,
    `hthAgreements` BOOLEAN NOT NULL,
    `hthPromotions` BOOLEAN NOT NULL,
    `mlhCodeOfConduct` BOOLEAN NOT NULL,
    `mlhPrivacyTerms` BOOLEAN NOT NULL,
    `mlhPromotions` BOOLEAN NOT NULL,
    `hasResume` BOOLEAN NOT NULL DEFAULT false,
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
CREATE TABLE `_LogToUser` (
    `A` INTEGER NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_LogToUser_AB_unique`(`A`, `B`),
    INDEX `_LogToUser_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
