CREATE TABLE `entities` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`description_vec` VECTOR(1536) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `entities_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_entity_unique` UNIQUE(`user_id`,`name`)
);
--> statement-breakpoint
CREATE TABLE `inputs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`content` text NOT NULL,
	`category` varchar(255),
	`tags` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `inputs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `queries` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`query` text NOT NULL,
	`result_count` int NOT NULL DEFAULT 0,
	`entities` json,
	`relationship` varchar(255),
	`postgres_query` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `queries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `relationships` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`source_entity_id` bigint unsigned NOT NULL,
	`target_entity_id` bigint unsigned NOT NULL,
	`relationship` varchar(255) NOT NULL,
	`relationship_vec` VECTOR(1536) NOT NULL,
	`relationship_desc` text,
	`relationship_desc_vec` VECTOR(1536),
	`original_input` text NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `relationships_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_source_rel_target_unique` UNIQUE(`user_id`,`source_entity_id`,`relationship`,`target_entity_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`username` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `entities` ADD CONSTRAINT `entities_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inputs` ADD CONSTRAINT `inputs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `queries` ADD CONSTRAINT `queries_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `relationships` ADD CONSTRAINT `relationships_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `relationships` ADD CONSTRAINT `relationships_source_entity_id_entities_id_fk` FOREIGN KEY (`source_entity_id`) REFERENCES `entities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `relationships` ADD CONSTRAINT `relationships_target_entity_id_entities_id_fk` FOREIGN KEY (`target_entity_id`) REFERENCES `entities`(`id`) ON DELETE no action ON UPDATE no action;