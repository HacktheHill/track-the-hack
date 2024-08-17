/*
  Warnings:

  - Added the required column `age` to the `Hacker` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Hacker` ADD COLUMN `age` INTEGER NOT NULL;
