-- Reliability-weighted triage: the final outcome (four levels) and its explanation.
ALTER TABLE `WoundAssessment` ADD COLUMN `triage` ENUM('ROUTINE', 'CONSULT', 'URGENT', 'UNABLE') NULL,
    ADD COLUMN `triageDetails` JSON NULL;

-- Results stored before this change get the outcome that matches their severity.
UPDATE `WoundAssessment`
SET `triage` = CASE `severity`
    WHEN 'MINOR' THEN 'ROUTINE'
    WHEN 'MODERATE' THEN 'CONSULT'
    WHEN 'SEVERE' THEN 'URGENT'
    ELSE 'UNABLE'
END;
