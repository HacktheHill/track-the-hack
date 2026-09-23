ALTER TABLE `Hacker` ADD COLUMN `rsvpRespondedAt` DATETIME(3) NULL;

UPDATE `Hacker` SET `rsvpRespondedAt` = `updatedAt` WHERE `confirmed` = true;

-- Before management links, only a participant who had confirmed could have
-- received a cancellation capability.
UPDATE `Hacker` h
INNER JOIN `CancellationCapability` c ON c.`hackerId` = h.`id`
SET h.`rsvpRespondedAt` = h.`updatedAt`
WHERE h.`confirmed` = false AND h.`rsvpRespondedAt` IS NULL;
