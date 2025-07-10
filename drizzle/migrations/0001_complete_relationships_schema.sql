-- Rename type column to relationship and add missing vector columns
ALTER TABLE `relationships` CHANGE COLUMN `type` `relationship` varchar(255) NOT NULL;

-- Add missing vector and description columns
ALTER TABLE `relationships` ADD COLUMN `relationship_vec` VECTOR(1536) NOT NULL;
ALTER TABLE `relationships` ADD COLUMN `relationship_desc` text;
ALTER TABLE `relationships` ADD COLUMN `relationship_desc_vec` VECTOR(1536);
ALTER TABLE `relationships` ADD COLUMN `original_input` text NOT NULL;

-- Add the proper unique constraint
DROP INDEX IF EXISTS `user_source_rel_target_unique` ON `relationships`;
CREATE UNIQUE INDEX `user_source_rel_target_unique` ON `relationships` (`user_id`, `source_entity_id`, `relationship`, `target_entity_id`);