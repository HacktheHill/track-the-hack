ALTER TABLE `HardwareItem`
  ADD COLUMN `inventoryMode` ENUM('COUNTED','UNCOUNTED') NOT NULL DEFAULT 'COUNTED',
  ADD COLUMN `availableForCheckout` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `consumptionAllowed` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `consumedQuantity` INTEGER NOT NULL DEFAULT 0,
  MODIFY `totalQuantity` INTEGER NULL,
  MODIFY `availableQuantity` INTEGER NULL;

ALTER TABLE `HardwareLoanLine`
  ADD COLUMN `consumedQuantity` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `HardwareReturnLine`
  ADD COLUMN `consumedQuantity` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `HardwareItem`
  ADD CONSTRAINT `HardwareItem_inventory_quantities_check` CHECK (
    (`inventoryMode` = 'COUNTED' AND `totalQuantity` IS NOT NULL AND `availableQuantity` IS NOT NULL
      AND `totalQuantity` >= 0 AND `availableQuantity` >= 0
      AND `availableQuantity` + `damagedQuantity` + `missingQuantity` + `consumedQuantity` <= `totalQuantity`)
    OR
    (`inventoryMode` = 'UNCOUNTED' AND `totalQuantity` IS NULL AND `availableQuantity` IS NULL
      AND `damagedQuantity` = 0 AND `missingQuantity` = 0 AND `consumedQuantity` = 0)
  ),
  ADD CONSTRAINT `HardwareItem_outcomes_nonnegative_check` CHECK (
    `damagedQuantity` >= 0 AND `missingQuantity` >= 0 AND `consumedQuantity` >= 0
  );

ALTER TABLE `HardwareLoanLine`
  ADD CONSTRAINT `HardwareLoanLine_outcomes_check` CHECK (
    `borrowedQuantity` > 0 AND `goodQuantity` >= 0 AND `damagedQuantity` >= 0
    AND `missingQuantity` >= 0 AND `consumedQuantity` >= 0
    AND `goodQuantity` + `damagedQuantity` + `missingQuantity` + `consumedQuantity` <= `borrowedQuantity`
  );

ALTER TABLE `HardwareReturnLine`
  ADD CONSTRAINT `HardwareReturnLine_outcomes_check` CHECK (
    `goodQuantity` >= 0 AND `damagedQuantity` >= 0 AND `missingQuantity` >= 0
    AND `consumedQuantity` >= 0
    AND `goodQuantity` + `damagedQuantity` + `missingQuantity` + `consumedQuantity` > 0
  );
