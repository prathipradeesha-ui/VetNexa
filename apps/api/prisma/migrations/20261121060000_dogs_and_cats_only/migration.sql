-- VetNexa is for dogs and cats only (pets, rescue reports and adoption listings).
--
-- Rows for other species cannot be converted to a dog or cat, so they are removed before the
-- enum is narrowed. Related rows (health records, assessments, consultations, applications)
-- are removed by the existing ON DELETE CASCADE foreign keys. When this migration was written,
-- the only such row was one seeded demo rescue report.
DELETE FROM `AdoptionListing` WHERE `species` NOT IN ('DOG', 'CAT');
DELETE FROM `RescueReport` WHERE `species` NOT IN ('DOG', 'CAT');
DELETE FROM `Pet` WHERE `species` NOT IN ('DOG', 'CAT');

ALTER TABLE `Pet` MODIFY `species` ENUM('DOG', 'CAT') NOT NULL;
ALTER TABLE `RescueReport` MODIFY `species` ENUM('DOG', 'CAT') NOT NULL;
ALTER TABLE `AdoptionListing` MODIFY `species` ENUM('DOG', 'CAT') NOT NULL;
