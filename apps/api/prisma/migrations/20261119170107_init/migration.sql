-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `firstName` VARCHAR(60) NOT NULL,
    `lastName` VARCHAR(60) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `role` ENUM('OWNER', 'VET', 'RESCUER', 'ADMIN') NOT NULL DEFAULT 'OWNER',
    `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    `avatarUrl` VARCHAR(191) NULL,
    `city` VARCHAR(80) NULL,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VetProfile` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `licenseNumber` VARCHAR(40) NOT NULL,
    `specialization` VARCHAR(120) NULL,
    `yearsExperience` INTEGER NULL,
    `bio` TEXT NULL,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `verifiedAt` DATETIME(3) NULL,
    `clinicId` VARCHAR(191) NULL,

    UNIQUE INDEX `VetProfile_userId_key`(`userId`),
    UNIQUE INDEX `VetProfile_licenseNumber_key`(`licenseNumber`),
    INDEX `VetProfile_clinicId_idx`(`clinicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pet` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `species` ENUM('DOG', 'CAT', 'RABBIT', 'BIRD', 'OTHER') NOT NULL,
    `breed` VARCHAR(80) NULL,
    `sex` ENUM('MALE', 'FEMALE', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `dateOfBirth` DATE NULL,
    `weightKg` DECIMAL(5, 2) NULL,
    `color` VARCHAR(60) NULL,
    `microchipId` VARCHAR(40) NULL,
    `isNeutered` BOOLEAN NOT NULL DEFAULT false,
    `photoUrl` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Pet_microchipId_key`(`microchipId`),
    INDEX `Pet_ownerId_idx`(`ownerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HealthRecord` (
    `id` VARCHAR(191) NOT NULL,
    `petId` VARCHAR(191) NOT NULL,
    `type` ENUM('VACCINATION', 'TREATMENT', 'CHECKUP', 'MEDICATION', 'ALLERGY', 'SURGERY') NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `recordDate` DATE NOT NULL,
    `nextDueDate` DATE NULL,
    `vetName` VARCHAR(120) NULL,
    `clinicName` VARCHAR(120) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HealthRecord_petId_recordDate_idx`(`petId`, `recordDate`),
    INDEX `HealthRecord_nextDueDate_idx`(`nextDueDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WoundAssessment` (
    `id` VARCHAR(191) NOT NULL,
    `petId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `imageUrl` VARCHAR(191) NOT NULL,
    `predictedClass` VARCHAR(60) NOT NULL,
    `confidence` DECIMAL(5, 4) NOT NULL,
    `severity` ENUM('MINOR', 'MODERATE', 'SEVERE', 'UNCERTAIN') NOT NULL,
    `probabilities` JSON NOT NULL,
    `guidance` TEXT NOT NULL,
    `modelVersion` VARCHAR(40) NOT NULL,
    `ownerNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `WoundAssessment_petId_createdAt_idx`(`petId`, `createdAt`),
    INDEX `WoundAssessment_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Clinic` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `slug` VARCHAR(140) NOT NULL,
    `description` TEXT NULL,
    `addressLine` VARCHAR(200) NOT NULL,
    `city` VARCHAR(80) NOT NULL,
    `district` VARCHAR(80) NOT NULL,
    `latitude` DECIMAL(9, 6) NULL,
    `longitude` DECIMAL(9, 6) NULL,
    `phone` VARCHAR(20) NOT NULL,
    `email` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `services` JSON NOT NULL,
    `openingHours` JSON NOT NULL,
    `hasEmergency` BOOLEAN NOT NULL DEFAULT false,
    `isOpen24Hours` BOOLEAN NOT NULL DEFAULT false,
    `imageUrl` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `averageRating` DECIMAL(3, 2) NOT NULL DEFAULT 0,
    `reviewCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Clinic_slug_key`(`slug`),
    INDEX `Clinic_city_idx`(`city`),
    INDEX `Clinic_district_idx`(`district`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Consultation` (
    `id` VARCHAR(191) NOT NULL,
    `petId` VARCHAR(191) NOT NULL,
    `ownerId` VARCHAR(191) NOT NULL,
    `vetId` VARCHAR(191) NULL,
    `clinicId` VARCHAR(191) NULL,
    `type` ENUM('IN_PERSON', 'VIDEO') NOT NULL DEFAULT 'IN_PERSON',
    `status` ENUM('REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
    `scheduledAt` DATETIME(3) NOT NULL,
    `reason` TEXT NOT NULL,
    `diagnosis` TEXT NULL,
    `treatment` TEXT NULL,
    `vetNotes` TEXT NULL,
    `followUpAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Consultation_ownerId_scheduledAt_idx`(`ownerId`, `scheduledAt`),
    INDEX `Consultation_vetId_scheduledAt_idx`(`vetId`, `scheduledAt`),
    INDEX `Consultation_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Review` (
    `id` VARCHAR(191) NOT NULL,
    `clinicId` VARCHAR(191) NOT NULL,
    `authorId` VARCHAR(191) NOT NULL,
    `rating` INTEGER NOT NULL,
    `title` VARCHAR(120) NULL,
    `comment` TEXT NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'APPROVED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Review_status_idx`(`status`),
    UNIQUE INDEX `Review_clinicId_authorId_key`(`clinicId`, `authorId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RescueReport` (
    `id` VARCHAR(191) NOT NULL,
    `reporterId` VARCHAR(191) NOT NULL,
    `assignedToId` VARCHAR(191) NULL,
    `species` ENUM('DOG', 'CAT', 'RABBIT', 'BIRD', 'OTHER') NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `description` TEXT NOT NULL,
    `locationText` VARCHAR(200) NOT NULL,
    `city` VARCHAR(80) NOT NULL,
    `latitude` DECIMAL(9, 6) NULL,
    `longitude` DECIMAL(9, 6) NULL,
    `urgency` ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL DEFAULT 'MEDIUM',
    `status` ENUM('OPEN', 'IN_PROGRESS', 'RESCUED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    `photoUrl` VARCHAR(191) NULL,
    `contactPhone` VARCHAR(20) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RescueReport_status_urgency_idx`(`status`, `urgency`),
    INDEX `RescueReport_city_idx`(`city`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdoptionListing` (
    `id` VARCHAR(191) NOT NULL,
    `rescuerId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `species` ENUM('DOG', 'CAT', 'RABBIT', 'BIRD', 'OTHER') NOT NULL,
    `breed` VARCHAR(80) NULL,
    `sex` ENUM('MALE', 'FEMALE', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `ageGroup` ENUM('BABY', 'YOUNG', 'ADULT', 'SENIOR') NOT NULL,
    `approxAgeMonths` INTEGER NULL,
    `size` VARCHAR(20) NULL,
    `city` VARCHAR(80) NOT NULL,
    `description` TEXT NOT NULL,
    `healthSummary` TEXT NULL,
    `isVaccinated` BOOLEAN NOT NULL DEFAULT false,
    `isNeutered` BOOLEAN NOT NULL DEFAULT false,
    `goodWithChildren` BOOLEAN NULL,
    `goodWithPets` BOOLEAN NULL,
    `photoUrl` VARCHAR(191) NULL,
    `status` ENUM('AVAILABLE', 'PENDING', 'ADOPTED', 'WITHDRAWN') NOT NULL DEFAULT 'AVAILABLE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AdoptionListing_status_species_idx`(`status`, `species`),
    INDEX `AdoptionListing_city_idx`(`city`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdoptionApplication` (
    `id` VARCHAR(191) NOT NULL,
    `listingId` VARCHAR(191) NOT NULL,
    `applicantId` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `homeType` VARCHAR(40) NOT NULL,
    `hasOtherPets` BOOLEAN NOT NULL DEFAULT false,
    `hasChildren` BOOLEAN NOT NULL DEFAULT false,
    `contactPhone` VARCHAR(20) NOT NULL,
    `status` ENUM('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN') NOT NULL DEFAULT 'SUBMITTED',
    `rescuerNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AdoptionApplication_listingId_applicantId_key`(`listingId`, `applicantId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ChatMessage` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `sender` ENUM('USER', 'ASSISTANT') NOT NULL,
    `content` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ChatMessage_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VetProfile` ADD CONSTRAINT `VetProfile_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VetProfile` ADD CONSTRAINT `VetProfile_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pet` ADD CONSTRAINT `Pet_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HealthRecord` ADD CONSTRAINT `HealthRecord_petId_fkey` FOREIGN KEY (`petId`) REFERENCES `Pet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HealthRecord` ADD CONSTRAINT `HealthRecord_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WoundAssessment` ADD CONSTRAINT `WoundAssessment_petId_fkey` FOREIGN KEY (`petId`) REFERENCES `Pet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WoundAssessment` ADD CONSTRAINT `WoundAssessment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Consultation` ADD CONSTRAINT `Consultation_petId_fkey` FOREIGN KEY (`petId`) REFERENCES `Pet`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Consultation` ADD CONSTRAINT `Consultation_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Consultation` ADD CONSTRAINT `Consultation_vetId_fkey` FOREIGN KEY (`vetId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Consultation` ADD CONSTRAINT `Consultation_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_clinicId_fkey` FOREIGN KEY (`clinicId`) REFERENCES `Clinic`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Review` ADD CONSTRAINT `Review_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RescueReport` ADD CONSTRAINT `RescueReport_reporterId_fkey` FOREIGN KEY (`reporterId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RescueReport` ADD CONSTRAINT `RescueReport_assignedToId_fkey` FOREIGN KEY (`assignedToId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdoptionListing` ADD CONSTRAINT `AdoptionListing_rescuerId_fkey` FOREIGN KEY (`rescuerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdoptionApplication` ADD CONSTRAINT `AdoptionApplication_listingId_fkey` FOREIGN KEY (`listingId`) REFERENCES `AdoptionListing`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdoptionApplication` ADD CONSTRAINT `AdoptionApplication_applicantId_fkey` FOREIGN KEY (`applicantId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ChatMessage` ADD CONSTRAINT `ChatMessage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
