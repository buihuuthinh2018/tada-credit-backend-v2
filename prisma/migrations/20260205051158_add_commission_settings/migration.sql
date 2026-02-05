/*
  Warnings:

  - You are about to drop the column `bonus_rate` on the `kpi_commission_tier` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `kpi_commission_tier` DROP COLUMN `bonus_rate`,
    ADD COLUMN `bonus_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `service` ADD COLUMN `commission_enabled` BOOLEAN NOT NULL DEFAULT true;
