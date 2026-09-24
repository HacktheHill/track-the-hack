-- Event Services are additive. The legacy `Hardware` table is deliberately
-- retained so the one-time importer can detect and refuse unexpected data.
CREATE TABLE `HardwareItem` (
  `id` VARCHAR(191) NOT NULL, `importKey` VARCHAR(191) NOT NULL,
  `category` ENUM('INPUTS','OUTPUTS','MICROCONTROLLERS','MISCELLANEOUS') NOT NULL,
  `name` VARCHAR(191) NOT NULL, `normalizedName` VARCHAR(191) NOT NULL,
  `description` TEXT NULL, `imageURL` VARCHAR(191) NULL,
  `totalQuantity` INTEGER NOT NULL, `availableQuantity` INTEGER NOT NULL,
  `damagedQuantity` INTEGER NOT NULL DEFAULT 0, `missingQuantity` INTEGER NOT NULL DEFAULT 0,
  `active` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `HardwareItem_importKey_key`(`importKey`),
  UNIQUE INDEX `HardwareItem_category_normalizedName_key`(`category`,`normalizedName`),
  INDEX `HardwareItem_name_idx`(`name`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `HardwareLoan` (
  `id` VARCHAR(191) NOT NULL, `hackerId` VARCHAR(191) NOT NULL,
  `pickupName` VARCHAR(191) NULL, `checkoutOrganizerId` VARCHAR(191) NOT NULL,
  `checkoutKey` VARCHAR(191) NOT NULL,
  `status` ENUM('OPEN','CLOSED','CLOSED_WITH_MISSING') NOT NULL DEFAULT 'OPEN',
  `idCollectedAt` DATETIME(3) NOT NULL, `idReturnedAt` DATETIME(3) NULL,
  `checkedOutAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `closedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `HardwareLoan_checkoutKey_key`(`checkoutKey`),
  INDEX `HardwareLoan_hackerId_status_idx`(`hackerId`,`status`),
  INDEX `HardwareLoan_pickupName_idx`(`pickupName`),
  INDEX `HardwareLoan_checkoutOrganizerId_idx`(`checkoutOrganizerId`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `HardwareLoanLine` (
  `id` VARCHAR(191) NOT NULL, `loanId` VARCHAR(191) NOT NULL, `itemId` VARCHAR(191) NOT NULL,
  `borrowedQuantity` INTEGER NOT NULL, `goodQuantity` INTEGER NOT NULL DEFAULT 0,
  `damagedQuantity` INTEGER NOT NULL DEFAULT 0, `missingQuantity` INTEGER NOT NULL DEFAULT 0,
  UNIQUE INDEX `HardwareLoanLine_loanId_itemId_key`(`loanId`,`itemId`),
  INDEX `HardwareLoanLine_itemId_idx`(`itemId`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `HardwareReturn` (
  `id` VARCHAR(191) NOT NULL, `loanId` VARCHAR(191) NOT NULL, `organizerId` VARCHAR(191) NOT NULL,
  `idempotencyKey` VARCHAR(191) NOT NULL, `returnedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `HardwareReturn_idempotencyKey_key`(`idempotencyKey`),
  INDEX `HardwareReturn_loanId_idx`(`loanId`), INDEX `HardwareReturn_organizerId_idx`(`organizerId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `HardwareReturnLine` (
  `id` VARCHAR(191) NOT NULL, `returnId` VARCHAR(191) NOT NULL, `loanLineId` VARCHAR(191) NOT NULL,
  `goodQuantity` INTEGER NOT NULL DEFAULT 0, `damagedQuantity` INTEGER NOT NULL DEFAULT 0,
  `missingQuantity` INTEGER NOT NULL DEFAULT 0,
  UNIQUE INDEX `HardwareReturnLine_returnId_loanLineId_key`(`returnId`,`loanLineId`),
  INDEX `HardwareReturnLine_loanLineId_idx`(`loanLineId`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LatteLabState` (
  `id` INTEGER NOT NULL DEFAULT 1, `open` BOOLEAN NOT NULL DEFAULT false,
  `updatedByOrganizerId` VARCHAR(191) NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `LatteLabState_updatedByOrganizerId_idx`(`updatedByOrganizerId`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LatteIngredientAvailability` (
  `ingredient` ENUM('COFFEE','DECAF','ICE','DAIRY_MILK','OAT_MILK','ALMOND_MILK','FRENCH_VANILLA','CARAMEL','BROWN_SUGAR_CINNAMON','CHOCOLATE','CHAI_CONCENTRATE','EARL_GREY','TEA','HOT_CHOCOLATE_MIX','SUGAR','SUGAR_SUBSTITUTE') NOT NULL,
  `available` BOOLEAN NOT NULL DEFAULT true, `updatedByOrganizerId` VARCHAR(191) NULL,
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `LatteIngredientAvailability_updatedByOrganizerId_idx`(`updatedByOrganizerId`), PRIMARY KEY (`ingredient`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LatteOrder` (
  `id` VARCHAR(191) NOT NULL, `hackerId` VARCHAR(191) NOT NULL, `activeHackerId` VARCHAR(191) NULL,
  `pickupName` VARCHAR(191) NULL, `drink` ENUM('COFFEE','DECAF_COFFEE','LATTE','MOCHA','CHAI_LATTE','LONDON_FOG','TEA','HOT_CHOCOLATE') NOT NULL,
  `temperature` ENUM('HOT','ICED') NOT NULL, `milkBase` ENUM('NONE','WATER','DAIRY','OAT','ALMOND') NOT NULL,
  `flavour` ENUM('NONE','FRENCH_VANILLA','CARAMEL','BROWN_SUGAR_CINNAMON','CHOCOLATE') NOT NULL,
  `sweetener` ENUM('NONE','SUGAR','SUBSTITUTE') NOT NULL,
  `status` ENUM('QUEUED','PREPARING','READY','COMPLETED','CANCELLED') NOT NULL DEFAULT 'QUEUED',
  `submissionKey` VARCHAR(191) NOT NULL,
  `cancellationReason` ENUM('PARTICIPANT_CANCELLED','INGREDIENT_UNAVAILABLE','DUPLICATE','UNCLAIMED','OTHER') NULL,
  `handledByOrganizerId` VARCHAR(191) NULL,
  `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `preparingAt` DATETIME(3) NULL,
  `readyAt` DATETIME(3) NULL, `completedAt` DATETIME(3) NULL, `cancelledAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `LatteOrder_activeHackerId_key`(`activeHackerId`),
  UNIQUE INDEX `LatteOrder_submissionKey_key`(`submissionKey`),
  INDEX `LatteOrder_hackerId_status_idx`(`hackerId`,`status`),
  INDEX `LatteOrder_status_submittedAt_idx`(`status`,`submittedAt`),
  INDEX `LatteOrder_handledByOrganizerId_idx`(`handledByOrganizerId`), PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `LatteLabState` (`id`, `open`) VALUES (1, false);
INSERT INTO `LatteIngredientAvailability` (`ingredient`, `available`) VALUES
 ('COFFEE',true),('DECAF',true),('ICE',true),('DAIRY_MILK',true),('OAT_MILK',true),('ALMOND_MILK',true),
 ('FRENCH_VANILLA',true),('CARAMEL',true),('BROWN_SUGAR_CINNAMON',true),('CHOCOLATE',true),
 ('CHAI_CONCENTRATE',true),('EARL_GREY',true),('TEA',true),('HOT_CHOCOLATE_MIX',true),
 ('SUGAR',true),('SUGAR_SUBSTITUTE',true);

CREATE TABLE `LatteOrderTransition` (
  `id` VARCHAR(191) NOT NULL, `orderId` VARCHAR(191) NOT NULL, `requestKey` VARCHAR(191) NOT NULL,
  `fromStatus` ENUM('QUEUED','PREPARING','READY','COMPLETED','CANCELLED') NOT NULL,
  `toStatus` ENUM('QUEUED','PREPARING','READY','COMPLETED','CANCELLED') NOT NULL,
  `organizerId` VARCHAR(191) NOT NULL, `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `LatteOrderTransition_requestKey_key`(`requestKey`),
  INDEX `LatteOrderTransition_orderId_idx`(`orderId`), INDEX `LatteOrderTransition_organizerId_idx`(`organizerId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
