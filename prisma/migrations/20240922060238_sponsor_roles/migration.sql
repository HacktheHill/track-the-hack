/*
  Warnings:

  - The values [SPONSOR] on the enum `Role_name` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `Role` MODIFY `name` ENUM('ADMIN', 'HACKER', 'ORGANIZER', 'ACCEPTANCE', 'MAYOR', 'PREMIER') NOT NULL;
