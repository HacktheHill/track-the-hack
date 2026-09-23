-- Access codes remain valid until consumed or replaced.
ALTER TABLE `ClaimToken` DROP COLUMN `expiresAt`;
