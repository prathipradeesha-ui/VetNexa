-- Wound assessments now record the full safety outcome: whether the model answered or was
-- uncertain, whether a vet visit is recommended, whether severity was escalated, the summary
-- shown to the owner and whether a demonstration model produced it.
--
-- Existing rows get safe values first (referred to a vet), then the temporary defaults are
-- removed so new rows must always supply them.
ALTER TABLE `WoundAssessment` ADD COLUMN `demoModel` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `escalated` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `referToVet` BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN `status` ENUM('ASSESSED', 'UNCERTAIN') NOT NULL DEFAULT 'ASSESSED',
    ADD COLUMN `summary` VARCHAR(200) NOT NULL DEFAULT '';

ALTER TABLE `WoundAssessment` ALTER COLUMN `referToVet` DROP DEFAULT,
    ALTER COLUMN `status` DROP DEFAULT,
    ALTER COLUMN `summary` DROP DEFAULT;
