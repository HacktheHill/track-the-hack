/*
  Warnings:

  - Made the column `travelAccommodations` on table `Hacker` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE `Hacker` MODIFY `travelAccommodations` ENUM('GTA', 'MONTREAL', 'WATERLOO', 'NONE') NOT NULL DEFAULT 'NONE';
