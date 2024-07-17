/*
  Warnings:

  - You are about to drop the column `formEndDate` on the `HackerInfo` table. All the data in the column will be lost.
  - You are about to drop the column `formStartDate` on the `HackerInfo` table. All the data in the column will be lost.
  - You are about to drop the column `resume` on the `HackerInfo` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `HackerInfo` DROP COLUMN `formEndDate`,
    DROP COLUMN `formStartDate`,
    DROP COLUMN `resume`,
    ADD COLUMN `hasResume` BOOLEAN NOT NULL DEFAULT false;
