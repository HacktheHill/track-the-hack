-- AlterTable
ALTER TABLE `Hacker`
    CHANGE COLUMN `applicationStatus` `acceptanceStatus` ENUM('PENDING', 'ACCEPTED', 'WAITLISTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    ADD COLUMN `acceptanceReason` VARCHAR(191) NOT NULL DEFAULT 'none'
