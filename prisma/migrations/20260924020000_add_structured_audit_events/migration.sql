-- CreateTable
CREATE TABLE `AuditEvent` (
    `id` VARCHAR(191) NOT NULL,
    `schemaVersion` INTEGER NOT NULL DEFAULT 1,
    `occurredAt` DATETIME(3) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `outcome` VARCHAR(191) NOT NULL,
    `correlationId` VARCHAR(191) NOT NULL,
    `actorType` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `subjectType` VARCHAR(191) NULL,
    `subjectId` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `resourceType` VARCHAR(191) NULL,
    `resourceId` VARCHAR(191) COLLATE utf8mb4_bin NULL,
    `data` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditEvent_actorId_occurredAt_idx`(`actorId`, `occurredAt`),
    INDEX `AuditEvent_subjectType_subjectId_occurredAt_idx`(`subjectType`, `subjectId`, `occurredAt`),
    INDEX `AuditEvent_resourceType_resourceId_occurredAt_idx`(`resourceType`, `resourceId`, `occurredAt`),
    INDEX `AuditEvent_name_outcome_occurredAt_idx`(`name`, `outcome`, `occurredAt`),
    INDEX `AuditEvent_occurredAt_idx`(`occurredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Preserve the preceding 90 days of legacy evidence without inventing
-- semantics. Scanner rows can recover their participant and event identifiers
-- through the Presence source row; all other rows retain their original source.
INSERT INTO `AuditEvent` (
    `id`, `schemaVersion`, `occurredAt`, `name`, `outcome`, `correlationId`,
    `actorType`, `actorId`, `subjectType`, `subjectId`, `resourceType`,
    `resourceId`, `data`, `createdAt`
)
SELECT
    CONCAT('legacy-', `Log`.`id`),
    1,
    `Log`.`timestamp`,
    CASE
        WHEN `Log`.`route` = 'presence.scan' THEN 'scanner.scan'
        WHEN `Log`.`route` = 'presence.adjust' THEN 'scanner.adjust'
        WHEN `Log`.`action` = 'UpdateRoles' THEN 'organizer.roles.updated'
        WHEN `Log`.`action` = 'IssueClaimToken' THEN 'participant.claim.issued'
        WHEN `Log`.`action` = 'ClaimParticipantAccess' THEN 'participant.claim.redeemed'
        WHEN `Log`.`action` IN ('ManageRsvpAttend', 'ManageRsvpDecline') THEN 'participant.rsvp.updated'
        WHEN `Log`.`action` = 'CancelRsvp' THEN 'participant.rsvp.cancelled'
        ELSE 'legacy.migrated'
    END,
    CASE `Log`.`action`
        WHEN 'scan' THEN 'recorded'
        WHEN 'scan_incremented' THEN 'incremented'
        WHEN 'scan_duplicate' THEN 'duplicate'
        WHEN 'scan_limit' THEN 'limit'
        WHEN 'adjust' THEN 'applied'
        WHEN 'adjust_stale' THEN 'stale'
        WHEN 'adjust_noop' THEN 'out_of_bounds'
        WHEN 'ManageRsvpAttend' THEN 'attending'
        WHEN 'ManageRsvpDecline' THEN 'declined'
        ELSE 'migrated'
    END,
    CONCAT('legacy-', `Log`.`id`),
    CASE WHEN `Log`.`userId` IS NULL THEN 'system' ELSE 'organizer' END,
    COALESCE(`Log`.`userId`, `Log`.`author`, 'legacy'),
    CASE WHEN `Presence`.`hackerId` IS NOT NULL OR `Log`.`sourceType` = 'Hacker' THEN 'hacker' ELSE NULL END,
    COALESCE(`Presence`.`hackerId`, CASE WHEN `Log`.`sourceType` = 'Hacker' THEN `Log`.`sourceId` ELSE NULL END),
    CASE
        WHEN `Presence`.`eventId` IS NOT NULL THEN 'event'
        WHEN `Log`.`sourceType` = 'User' THEN 'role'
        WHEN `Log`.`sourceType` = 'Presence' THEN 'presence'
        ELSE NULL
    END,
    COALESCE(`Presence`.`eventId`, CASE WHEN `Log`.`sourceType` IN ('User', 'Presence') THEN `Log`.`sourceId` ELSE NULL END),
    JSON_OBJECT(
        'legacyAction', `Log`.`action`,
        'legacyRoute', `Log`.`route`,
        'legacySourceType', `Log`.`sourceType`,
        'legacyDetails', `Log`.`details`
    ),
    `Log`.`timestamp`
FROM `Log`
LEFT JOIN `Presence` ON `Log`.`sourceType` = 'Presence' AND `Presence`.`id` = `Log`.`sourceId`
WHERE `Log`.`timestamp` >= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 90 DAY);
