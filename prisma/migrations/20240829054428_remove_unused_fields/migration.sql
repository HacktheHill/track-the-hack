/*
  Warnings:

  - You are about to drop the column `mlhCodeOfConduct` on the `Hacker` table. All the data in the column will be lost.
  - You are about to drop the column `mlhPrivacyTerms` on the `Hacker` table. All the data in the column will be lost.
  - You are about to drop the column `mlhPromotions` on the `Hacker` table. All the data in the column will be lost.
  - You are about to drop the column `travelAccommodations` on the `Hacker` table. All the data in the column will be lost.
*/
-- AlterTable
ALTER TABLE `Hacker`
    RENAME COLUMN `hthAgreements` TO `agreements`,
    RENAME COLUMN `hthPromotions` TO `promotions`,
    DROP COLUMN `mlhCodeOfConduct`,
    DROP COLUMN `mlhPrivacyTerms`,
    DROP COLUMN `mlhPromotions`,
    DROP COLUMN `travelAccommodations`;
