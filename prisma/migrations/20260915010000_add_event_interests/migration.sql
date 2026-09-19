-- CreateTable
CREATE TABLE `EventInterest` (
    `id` VARCHAR(191) NOT NULL,
    `hackerId` VARCHAR(191) NOT NULL,
    `eventId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EventInterest_eventId_idx`(`eventId`),
    UNIQUE INDEX `EventInterest_hackerId_eventId_key`(`hackerId`, `eventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
