-- AlterTable
ALTER TABLE `contract` ADD COLUMN `disbursed_amount` DECIMAL(15, 2) NULL,
    ADD COLUMN `requested_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `service` ADD COLUMN `max_loan_amount` DECIMAL(15, 2) NOT NULL DEFAULT 100000000,
    ADD COLUMN `min_loan_amount` DECIMAL(15, 2) NOT NULL DEFAULT 1000000;
