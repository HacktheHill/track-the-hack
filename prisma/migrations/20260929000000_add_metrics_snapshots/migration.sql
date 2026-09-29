-- CreateTable
CREATE TABLE `MetricsSnapshot` (
    `source` VARCHAR(191) NOT NULL,
    `payload` JSON NOT NULL,
    `capturedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MetricsSnapshot_capturedAt_idx`(`capturedAt`),
    PRIMARY KEY (`source`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
