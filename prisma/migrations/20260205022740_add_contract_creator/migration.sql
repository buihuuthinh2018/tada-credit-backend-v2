-- AlterTable
ALTER TABLE `contract` ADD COLUMN `creator_id` VARCHAR(191) NULL;

-- AddForeignKey
ALTER TABLE `contract` ADD CONSTRAINT `contract_creator_id_fkey` FOREIGN KEY (`creator_id`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
