-- The raw participant-session capability is stored only in the browser cookie.
-- `verifier` is an HMAC derived with PARTICIPANT_SESSION_SECRET.
CREATE TABLE `ParticipantSession` (
    `verifier` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `hackerId` VARCHAR(191) COLLATE utf8mb4_bin NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ParticipantSession_hackerId_key`(`hackerId`),
    PRIMARY KEY (`verifier`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
