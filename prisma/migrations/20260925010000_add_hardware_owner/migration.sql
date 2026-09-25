ALTER TABLE `HardwareItem`
  ADD COLUMN `owner` ENUM('CTN','MLH') NOT NULL DEFAULT 'CTN' AFTER `category`;
