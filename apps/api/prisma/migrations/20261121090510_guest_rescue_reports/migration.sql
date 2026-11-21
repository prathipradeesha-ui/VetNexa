-- AlterTable
ALTER TABLE `RescueReport` ADD COLUMN `reporterName` VARCHAR(80) NULL,
    MODIFY `reporterId` VARCHAR(191) NULL;
