/*
  Warnings:

  - A unique constraint covering the columns `[contract_number]` on the table `contract` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `contract_number` to the `contract` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: Add column with nullable first
ALTER TABLE `contract` ADD COLUMN `contract_number` VARCHAR(191) NULL;

-- Update existing rows with generated contract numbers based on created_at order
SET @row_number = 0;
UPDATE `contract` 
SET `contract_number` = CONCAT('HD-', YEAR(created_at), '-', LPAD((@row_number := @row_number + 1), 6, '0'))
WHERE `contract_number` IS NULL
ORDER BY `created_at`;

-- Make the column NOT NULL after populating data
ALTER TABLE `contract` MODIFY COLUMN `contract_number` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `contract_contract_number_key` ON `contract`(`contract_number`);
