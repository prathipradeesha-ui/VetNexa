-- Advisory skin-condition check stored with each photo assessment.
ALTER TABLE `WoundAssessment` ADD COLUMN `skinCheck` JSON NULL;
