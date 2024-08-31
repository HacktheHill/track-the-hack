/*
  Warnings:

  - A unique constraint covering the columns `[teamId]` on the table `Hacker` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[presenceInfoId]` on the table `Hacker` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `Hacker` ADD COLUMN `teamId` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Team` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Team_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Hacker_teamId_idx` ON `Hacker`(`teamId`);
