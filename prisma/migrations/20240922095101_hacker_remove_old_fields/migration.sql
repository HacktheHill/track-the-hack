/*
  Warnings:

  - You are about to drop the column `presenceInfoId` on the `Hacker` table. All the data in the column will be lost.
  - You are about to drop the column `winner` on the `Hacker` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX `Hacker_presenceInfoId_idx` ON `Hacker`;

-- AlterTable
ALTER TABLE `Hacker` DROP COLUMN `presenceInfoId`,
    DROP COLUMN `winner`;
