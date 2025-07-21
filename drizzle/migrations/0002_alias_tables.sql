CREATE TABLE `alias_groups` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`canonical_entity_id` bigint unsigned,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `alias_groups_id` PRIMARY KEY(`id`)
);

CREATE TABLE `entity_aliases` (
	`entity_id` bigint unsigned NOT NULL,
	`alias_group_id` bigint unsigned NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `entity_aliases_entity_id` PRIMARY KEY(`entity_id`)
);

ALTER TABLE `alias_groups` ADD CONSTRAINT `alias_groups_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `alias_groups` ADD CONSTRAINT `alias_groups_canonical_entity_id_entities_id_fk` FOREIGN KEY (`canonical_entity_id`) REFERENCES `entities`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `entity_aliases` ADD CONSTRAINT `entity_aliases_entity_id_entities_id_fk` FOREIGN KEY (`entity_id`) REFERENCES `entities`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `entity_aliases` ADD CONSTRAINT `entity_aliases_alias_group_id_alias_groups_id_fk` FOREIGN KEY (`alias_group_id`) REFERENCES `alias_groups`(`id`) ON DELETE no action ON UPDATE no action;
ALTER TABLE `entity_aliases` ADD CONSTRAINT `entity_aliases_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;