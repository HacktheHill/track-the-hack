/*
  Warnings:

  - You are about to drop the column `user_id` on the `AuditLog` table. All the data in the column will be lost.
  - The primary key for the `HackerInfo` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `attendanceLocation` on the `HackerInfo` table. All the data in the column will be lost.
  - You are about to drop the column `linkResume` on the `HackerInfo` table. All the data in the column will be lost.
  - You are about to drop the column `submissionID` on the `HackerInfo` table. All the data in the column will be lost.
  - You are about to drop the column `profileImage` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `username` on the `User` table. All the data in the column will be lost.
  - Added the required column `userId` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - The required column `id` was added to the `HackerInfo` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropIndex
DROP INDEX `AuditLog_user_id_idx` ON `AuditLog`;

-- AlterTable
ALTER TABLE `AuditLog` DROP COLUMN `user_id`,
    ADD COLUMN `userId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `HackerInfo` DROP PRIMARY KEY,
    DROP COLUMN `attendanceLocation`,
    DROP COLUMN `linkResume`,
    DROP COLUMN `submissionID`,
    ADD COLUMN `id` VARCHAR(191) NOT NULL,
    ADD COLUMN `location` VARCHAR(191) NULL,
    ADD COLUMN `resume` TEXT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `User` DROP COLUMN `profileImage`,
    DROP COLUMN `username`,
    ADD COLUMN `image` VARCHAR(191) NULL,
    ADD COLUMN `name` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `AuditLog_userId_idx` ON `AuditLog`(`userId`);
