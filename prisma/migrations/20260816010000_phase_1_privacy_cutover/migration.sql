-- Phase 1 is a privacy cutover for a fresh event. Legacy participant records,
-- participant-linked sessions/accounts, and their audit details are deliberately
-- removed instead of migrated into the pseudonymous operational model.

CREATE TEMPORARY TABLE `RetiredUser` AS
SELECT `u`.`id`
FROM `User` AS `u`
WHERE `u`.`email` IS NULL
   OR LOWER(`u`.`email`) NOT LIKE '%@ctn-rtc.org'
   OR NOT EXISTS (
       SELECT 1
       FROM `_RoleToUser` AS `ru`
       INNER JOIN `Role` AS `r` ON `r`.`id` = `ru`.`A`
       WHERE `ru`.`B` = `u`.`id`
         AND `r`.`name` IN ('ADMIN', 'ORGANIZER', 'MAYOR', 'PREMIER')
   );

DELETE FROM `Session`;
DELETE FROM `Account`
WHERE `provider` <> 'google'
   OR `userId` IN (SELECT `id` FROM `RetiredUser`);
DELETE FROM `_RoleToUser`
WHERE `B` IN (SELECT `id` FROM `RetiredUser`);
DELETE FROM `_LogToUser`
WHERE `B` IN (SELECT `id` FROM `RetiredUser`);
DELETE FROM `User`
WHERE `id` IN (SELECT `id` FROM `RetiredUser`);

DROP TABLE `VerificationToken`;
DELETE FROM `_LogToUser`;
DELETE FROM `Log`;
DELETE FROM `Presence` WHERE `hackerId` IS NOT NULL;
DELETE FROM `Hacker`;

DROP TEMPORARY TABLE `RetiredUser`;

DELETE FROM `_RoleToUser`
WHERE `A` IN (SELECT `id` FROM `Role` WHERE `name` IN ('HACKER', 'ACCEPTANCE'));
DELETE FROM `Role` WHERE `name` IN ('HACKER', 'ACCEPTANCE');

ALTER TABLE `User` DROP COLUMN `passwordHash`;

DROP INDEX `Hacker_userId_key` ON `Hacker`;
DROP INDEX `Hacker_userId_idx` ON `Hacker`;
DROP INDEX `Hacker_unsubscribeToken_key` ON `Hacker`;

ALTER TABLE `Hacker`
    DROP COLUMN `preferredLanguage`,
    DROP COLUMN `firstName`,
    DROP COLUMN `lastName`,
    DROP COLUMN `email`,
    DROP COLUMN `phoneNumber`,
    DROP COLUMN `country`,
    DROP COLUMN `age`,
    DROP COLUMN `gender`,
    DROP COLUMN `pronouns`,
    DROP COLUMN `raceEthnicity`,
    DROP COLUMN `currentSchoolOrganization`,
    DROP COLUMN `educationLevel`,
    DROP COLUMN `major`,
    DROP COLUMN `linkedin`,
    DROP COLUMN `github`,
    DROP COLUMN `personalWebsite`,
    DROP COLUMN `hackathonBefore`,
    DROP COLUMN `hackathonDetails`,
    DROP COLUMN `programmingLanguagesTechnologies`,
    DROP COLUMN `projectDescription`,
    DROP COLUMN `participationReason`,
    DROP COLUMN `learningGoals`,
    DROP COLUMN `emergencyContactName`,
    DROP COLUMN `emergencyContactRelation`,
    DROP COLUMN `emergencyContactPhoneNumber`,
    DROP COLUMN `dietaryRestrictions`,
    DROP COLUMN `specialAccommodations`,
    DROP COLUMN `additionalInfo`,
    DROP COLUMN `travelOrigin`,
    DROP COLUMN `referralSource`,
    DROP COLUMN `agreements`,
    DROP COLUMN `promotions`,
    DROP COLUMN `hasResume`,
    DROP COLUMN `acceptanceStatus`,
    DROP COLUMN `acceptanceReason`,
    DROP COLUMN `unsubscribed`,
    DROP COLUMN `unsubscribeToken`,
    DROP COLUMN `userId`,
    ADD COLUMN `mealCategory` ENUM('STANDARD', 'VEGETARIAN', 'VEGAN', 'HALAL', 'OTHER') NOT NULL,
    MODIFY COLUMN `acceptanceExpiry` DATETIME(3) NOT NULL;

ALTER TABLE `Role`
    MODIFY COLUMN `name` ENUM('ADMIN', 'ORGANIZER', 'MAYOR', 'PREMIER') NOT NULL;

CREATE TABLE `CancellationCapability` (
    `id` VARCHAR(191) NOT NULL,
    `hackerId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `CancellationCapability_hackerId_key`(`hackerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
