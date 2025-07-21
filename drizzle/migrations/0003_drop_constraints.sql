-- Drop all foreign key constraints to allow table truncation
ALTER TABLE `relationships` DROP FOREIGN KEY `relationships_source_entity_id_entities_id_fk`;
ALTER TABLE `relationships` DROP FOREIGN KEY `relationships_target_entity_id_entities_id_fk`;
ALTER TABLE `relationships` DROP FOREIGN KEY `relationships_user_id_users_id_fk`;
ALTER TABLE `entities` DROP FOREIGN KEY `entities_user_id_users_id_fk`;
ALTER TABLE `inputs` DROP FOREIGN KEY `inputs_user_id_users_id_fk`;
ALTER TABLE `queries` DROP FOREIGN KEY `queries_user_id_users_id_fk`;

-- Drop unique indexes as well to avoid conflicts
DROP INDEX `user_entity_unique` ON `entities`;
DROP INDEX `user_source_rel_target_unique` ON `relationships`;