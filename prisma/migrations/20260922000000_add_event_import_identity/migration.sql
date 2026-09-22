ALTER TABLE `Event`
	ADD COLUMN `importKey` VARCHAR(191) NULL,
	ADD COLUMN `seriesKey` VARCHAR(191) NULL,
    MODIFY `type` ENUM('ALL', 'GENERAL', 'COMPETITION', 'WORKSHOP', 'SOCIAL', 'CAREER_FAIR', 'FOOD') NOT NULL DEFAULT 'ALL';

CREATE UNIQUE INDEX `Event_importKey_key` ON `Event`(`importKey`);
CREATE INDEX `Event_seriesKey_start_idx` ON `Event`(`seriesKey`, `start`);
