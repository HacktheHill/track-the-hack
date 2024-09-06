/*
  Warnings:

  - The primary key for the `Presence` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `key` on the `Presence` table. All the data in the column will be lost.
  - The required column `id` was added to the `Presence` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- DropIndex
DROP INDEX `Presence_key_key` ON `Presence`;

-- AlterTable
ALTER TABLE `Presence` DROP PRIMARY KEY,
    DROP COLUMN `key`,
    ADD COLUMN `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);
