-- AlterTable
ALTER TABLE `workflow_stage` ADD COLUMN `is_required` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `triggers_commission` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `kpi_commission_tier` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `role_code` VARCHAR(191) NOT NULL,
    `min_contracts` INTEGER NULL,
    `min_disbursement` DECIMAL(15, 2) NULL,
    `bonus_rate` DECIMAL(5, 4) NOT NULL,
    `tier_order` INTEGER NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `commission_snapshot` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `period_month` INTEGER NOT NULL,
    `period_year` INTEGER NOT NULL,
    `total_contracts` INTEGER NOT NULL,
    `total_disbursement` DECIMAL(15, 2) NOT NULL,
    `base_commission` DECIMAL(15, 2) NOT NULL,
    `kpi_tier_id` VARCHAR(191) NULL,
    `bonus_commission` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total_commission` DECIMAL(15, 2) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `processed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `commission_snapshot_period_year_period_month_idx`(`period_year`, `period_month`),
    UNIQUE INDEX `commission_snapshot_user_id_period_month_period_year_key`(`user_id`, `period_month`, `period_year`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `commission_record` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `contract_id` VARCHAR(191) NOT NULL,
    `referred_user_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `rate` DECIMAL(5, 4) NOT NULL,
    `disbursement_amount` DECIMAL(15, 2) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `snapshot_id` VARCHAR(191) NULL,
    `credited_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `commission_record_user_id_status_idx`(`user_id`, `status`),
    INDEX `commission_record_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `commission_snapshot` ADD CONSTRAINT `commission_snapshot_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commission_snapshot` ADD CONSTRAINT `commission_snapshot_kpi_tier_id_fkey` FOREIGN KEY (`kpi_tier_id`) REFERENCES `kpi_commission_tier`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commission_record` ADD CONSTRAINT `commission_record_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `commission_record` ADD CONSTRAINT `commission_record_referred_user_id_fkey` FOREIGN KEY (`referred_user_id`) REFERENCES `user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
