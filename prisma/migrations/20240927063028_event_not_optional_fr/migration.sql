/*
  Warnings:

  - Added the required column `descriptionFr` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nameFr` to the `Event` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Event` ADD COLUMN `descriptionFr` TEXT NOT NULL,
    ADD COLUMN `hidden` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `linkTextFr` VARCHAR(191) NULL,
    ADD COLUMN `nameFr` VARCHAR(191) NOT NULL;
