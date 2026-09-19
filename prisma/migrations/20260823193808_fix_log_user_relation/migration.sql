-- Preserve any unambiguous relation data created through the accidental
-- many-to-many field. The scalar subquery intentionally fails instead of
-- silently choosing a user if a log was linked to more than one user.
UPDATE `Log`
SET `userId` = (
    SELECT `_LogToUser`.`B`
    FROM `_LogToUser`
    WHERE `_LogToUser`.`A` = `Log`.`id`
)
WHERE `userId` IS NULL
  AND EXISTS (
      SELECT 1
      FROM `_LogToUser`
      WHERE `_LogToUser`.`A` = `Log`.`id`
  );

-- DropTable
DROP TABLE `_LogToUser`;
