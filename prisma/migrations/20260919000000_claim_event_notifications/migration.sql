ALTER TABLE `Event`
    ADD COLUMN `notificationLeaseToken` VARCHAR(191) NULL,
    ADD COLUMN `notificationLeaseUntil` DATETIME(3) NULL;

-- Push endpoint tokens are case-sensitive.
ALTER TABLE `PushSubscription` MODIFY `endpoint` VARCHAR(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL;

-- Concurrent registrations could previously create duplicate rows. Retain the
-- most recently updated keys for each event/endpoint before adding uniqueness.
DELETE older FROM `PushSubscription` AS older
INNER JOIN `PushSubscription` AS newer
    ON older.eventId = newer.eventId AND older.endpoint = newer.endpoint
    AND (older.updatedAt < newer.updatedAt OR (older.updatedAt = newer.updatedAt AND older.id < newer.id));

CREATE UNIQUE INDEX `PushSubscription_eventId_endpoint_key` ON `PushSubscription`(`eventId`, `endpoint`);
