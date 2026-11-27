-- CreateTable
CREATE TABLE `WoundFollowUp` (
    `id` VARCHAR(191) NOT NULL,
    `assessmentId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `dueAt` DATETIME(3) NOT NULL,
    `progress` ENUM('BETTER', 'SAME', 'WORSE') NULL,
    `note` TEXT NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WoundFollowUp_userId_completedAt_dueAt_idx`(`userId`, `completedAt`, `dueAt`),
    INDEX `WoundFollowUp_assessmentId_idx`(`assessmentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `WoundFollowUp` ADD CONSTRAINT `WoundFollowUp_assessmentId_fkey` FOREIGN KEY (`assessmentId`) REFERENCES `WoundAssessment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WoundFollowUp` ADD CONSTRAINT `WoundFollowUp_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
