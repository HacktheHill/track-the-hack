-- Scanner behavior is attached to the Event instead of inferred from its name.
ALTER TABLE `Event`
    ADD COLUMN `scannerWorkflow` ENUM('CHECK_IN', 'MERCHANDISE', 'FOOD', 'ATTENDANCE') NOT NULL DEFAULT 'ATTENDANCE';

-- Presence counters are identified by participant and event. This removes the
-- client-controlled label as an authorization and counter identity boundary.
-- The project assumes a clean database for this schema cutover.
ALTER TABLE `Presence`
    DROP INDEX `Presence_hackerId_idx`,
    MODIFY `hackerId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    ADD COLUMN `eventId` VARCHAR(191) NOT NULL,
    ADD UNIQUE INDEX `Presence_hackerId_eventId_key`(`hackerId`, `eventId`),
    ADD INDEX `Presence_eventId_idx`(`eventId`);
