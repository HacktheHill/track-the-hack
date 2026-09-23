ALTER TABLE `Event` ADD COLUMN `smsNotifiedAt` DATETIME(3) NULL;

CREATE TABLE `SmsContact` (
    `id` VARCHAR(191) NOT NULL,
    `hackerId` VARCHAR(191) NOT NULL,
    `encryptedPhone` TEXT NOT NULL,
    `encryptionKeyId` VARCHAR(512) NOT NULL,
    `phoneHash` VARCHAR(64) NULL,
    `status` ENUM('PENDING_VERIFICATION', 'VERIFIED', 'REVOKED', 'INVALID') NOT NULL DEFAULT 'PENDING_VERIFICATION',
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `SmsContact_hackerId_key`(`hackerId`),
    UNIQUE INDEX `SmsContact_phoneHash_key`(`phoneHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SmsConsent` (
    `id` VARCHAR(191) NOT NULL,
    `contactId` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'ACTIVE', 'REVOKED') NOT NULL DEFAULT 'PENDING',
    `policyVersion` VARCHAR(64) NOT NULL,
    `locale` VARCHAR(5) NOT NULL,
    `consentedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `SmsConsent_contactId_key`(`contactId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SmsVerification` (
    `id` VARCHAR(191) NOT NULL,
    `contactId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `codeDigest` VARCHAR(64) NOT NULL,
    `encryptedCode` TEXT NOT NULL,
    `codeEncryptionKeyId` VARCHAR(512) NOT NULL,
    `status` ENUM('PENDING', 'SENT', 'CONSUMED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `sentAt` DATETIME(3) NULL,
    `consumedAt` DATETIME(3) NULL,
    `failureCode` VARCHAR(64) NULL,
    `leaseToken` VARCHAR(191) NULL,
    `leaseUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `SmsVerification_contactId_key`(`contactId`),
    INDEX `SmsVerification_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `EventSmsSubscription` (
    `id` VARCHAR(191) NOT NULL,
    `contactId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `locale` VARCHAR(5) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'DELIVERED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `providerMessageId` VARCHAR(191) NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `nextAttemptAt` DATETIME(3) NULL,
    `acceptedAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `failureCode` VARCHAR(64) NULL,
    `leaseToken` VARCHAR(191) NULL,
    `leaseUntil` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `EventSmsSubscription_providerMessageId_key`(`providerMessageId`),
    UNIQUE INDEX `EventSmsSubscription_contactId_eventId_key`(`contactId`, `eventId`),
    INDEX `EventSmsSubscription_eventId_status_nextAttemptAt_idx`(`eventId`, `status`, `nextAttemptAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SmsSuppression` (
    `id` VARCHAR(191) NOT NULL,
    `phoneHash` VARCHAR(64) NOT NULL,
    `reason` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `SmsSuppression_phoneHash_key`(`phoneHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `SmsDailyUsage` (
    `day` DATE NOT NULL,
    `segments` INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (`day`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
