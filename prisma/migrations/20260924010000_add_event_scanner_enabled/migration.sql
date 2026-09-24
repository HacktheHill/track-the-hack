ALTER TABLE `Event`
    ADD COLUMN `scannerEnabled` BOOLEAN NOT NULL DEFAULT true;

-- Seed the known schedule-only activities once. Future changes use the
-- explicit field and do not depend on an event's mutable name or broad type.
UPDATE `Event`
SET `scannerEnabled` = false
WHERE `type` = 'CAREER_FAIR'
   OR `name` IN ('Team Formation', 'Closing Ceremony');
