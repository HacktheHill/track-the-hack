-- AlterTable
ALTER TABLE `Hacker` MODIFY `hackathonDetails` TEXT NOT NULL,
    MODIFY `programmingLanguagesTechnologies` TEXT NOT NULL,
    MODIFY `projectDescription` TEXT NOT NULL,
    MODIFY `participationReason` TEXT NOT NULL,
    MODIFY `learningGoals` TEXT NOT NULL,
    MODIFY `specialAccommodations` TEXT NULL,
    MODIFY `additionalInfo` TEXT NULL;
