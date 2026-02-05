-- AlterTable
ALTER TABLE `commission_record` ADD COLUMN `revenue_percentage` DECIMAL(5, 2) NULL,
    ADD COLUMN `total_revenue` DECIMAL(15, 2) NULL;

-- AlterTable
ALTER TABLE `contract` ADD COLUMN `revenue_percentage` DECIMAL(5, 2) NULL,
    ADD COLUMN `total_revenue` DECIMAL(15, 2) NULL;
