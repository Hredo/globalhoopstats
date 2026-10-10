-- Scouting workspace — run ONCE in phpMyAdmin BEFORE merging/deploying.
--
-- Adds the tables behind follows + alerts, web push, collaborative shortlists,
-- read-only share links, public API keys and server error tracking, plus the
-- `user_settings.email_alerts` preference.
--
-- Purely additive: no existing column, key or row is touched, so it is safe
-- with the code that is live today (that code never names these tables) and
-- required by the new code. Generated with drizzle-kit as the diff between the
-- previous schema and this one, minus its no-op datetime MODIFY noise.

CREATE TABLE IF NOT EXISTS `api_clients` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`key_prefix` varchar(16) NOT NULL,
	`key_hash` varchar(64) NOT NULL,
	`daily_quota` int NOT NULL DEFAULT 1000,
	`last_used_at` datetime(3),
	`revoked_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `api_clients_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_clients_key_hash_idx` UNIQUE(`key_hash`)
);

CREATE TABLE IF NOT EXISTS `app_errors` (
	`id` varchar(36) NOT NULL,
	`fingerprint` varchar(64) NOT NULL,
	`kind` varchar(32) NOT NULL,
	`route` varchar(191),
	`method` varchar(16),
	`message` text NOT NULL,
	`stack` mediumtext,
	`digest` varchar(64),
	`count` int NOT NULL DEFAULT 1,
	`first_seen_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`last_seen_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `app_errors_id` PRIMARY KEY(`id`),
	CONSTRAINT `app_errors_fingerprint_idx` UNIQUE(`fingerprint`)
);

CREATE TABLE IF NOT EXISTS `follows` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`kind` varchar(16) NOT NULL,
	`target_id` varchar(36) NOT NULL,
	`thresholds` json,
	`snapshot` json,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `follows_id` PRIMARY KEY(`id`),
	CONSTRAINT `follows_user_target_idx` UNIQUE(`user_id`,`kind`,`target_id`)
);

CREATE TABLE IF NOT EXISTS `notifications` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`kind` varchar(32) NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`href` varchar(512),
	`read_at` datetime(3),
	`emailed_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `push_subscriptions` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`endpoint` varchar(768) NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `push_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `push_subscriptions_endpoint_idx` UNIQUE(`endpoint`)
);

CREATE TABLE IF NOT EXISTS `shared_links` (
	`id` varchar(36) NOT NULL,
	`token` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`kind` varchar(16) NOT NULL,
	`target_id` varchar(36) NOT NULL,
	`note` text,
	`view_count` int NOT NULL DEFAULT 0,
	`expires_at` datetime(3) NOT NULL,
	`revoked_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `shared_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `shared_links_token_idx` UNIQUE(`token`)
);

CREATE TABLE IF NOT EXISTS `shortlist_comments` (
	`id` varchar(36) NOT NULL,
	`shortlist_id` varchar(36) NOT NULL,
	`item_id` varchar(36),
	`user_id` varchar(36) NOT NULL,
	`body` text NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `shortlist_comments_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `shortlist_items` (
	`id` varchar(36) NOT NULL,
	`shortlist_id` varchar(36) NOT NULL,
	`player_id` varchar(36) NOT NULL,
	`status` varchar(16) NOT NULL DEFAULT 'watch',
	`note` text,
	`added_by` varchar(36),
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `shortlist_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `shortlist_items_unique_idx` UNIQUE(`shortlist_id`,`player_id`)
);

CREATE TABLE IF NOT EXISTS `shortlist_members` (
	`id` varchar(36) NOT NULL,
	`shortlist_id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`role` varchar(16) NOT NULL DEFAULT 'editor',
	`added_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `shortlist_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `shortlist_members_unique_idx` UNIQUE(`shortlist_id`,`user_id`)
);

CREATE TABLE IF NOT EXISTS `shortlists` (
	`id` varchar(36) NOT NULL,
	`owner_id` varchar(36) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3)),
	CONSTRAINT `shortlists_id` PRIMARY KEY(`id`)
);

ALTER TABLE `announcements` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `announcements` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `app_config` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `coaches` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `coaches` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `compare_uses` MODIFY COLUMN `used_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `conversations` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `conversations` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `messages` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `page_views` MODIFY COLUMN `viewed_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `password_reset_tokens` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `playbook_plays` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `playbook_plays` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `search_log` MODIFY COLUMN `searched_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `sessions` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `sync_runs` MODIFY COLUMN `started_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `two_factor_backup_codes` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `two_factor_sessions` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `user_api_keys` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `user_api_keys` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `user_settings` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `user_settings` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `users` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `users` MODIFY COLUMN `updated_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `videos` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `waitlist_entries` MODIFY COLUMN `created_at` datetime(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP(3));
ALTER TABLE `user_settings` ADD `email_alerts` boolean DEFAULT true NOT NULL;
ALTER TABLE `api_clients` ADD CONSTRAINT `api_clients_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `follows` ADD CONSTRAINT `follows_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `shared_links` ADD CONSTRAINT `shared_links_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `shortlist_comments` ADD CONSTRAINT `shortlist_comments_shortlist_id_shortlists_id_fk` FOREIGN KEY (`shortlist_id`) REFERENCES `shortlists`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `shortlist_comments` ADD CONSTRAINT `shortlist_comments_item_id_shortlist_items_id_fk` FOREIGN KEY (`item_id`) REFERENCES `shortlist_items`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `shortlist_comments` ADD CONSTRAINT `shortlist_comments_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `shortlist_items` ADD CONSTRAINT `shortlist_items_shortlist_id_shortlists_id_fk` FOREIGN KEY (`shortlist_id`) REFERENCES `shortlists`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `shortlist_items` ADD CONSTRAINT `shortlist_items_player_id_players_id_fk` FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `shortlist_items` ADD CONSTRAINT `shortlist_items_added_by_users_id_fk` FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
ALTER TABLE `shortlist_members` ADD CONSTRAINT `shortlist_members_shortlist_id_shortlists_id_fk` FOREIGN KEY (`shortlist_id`) REFERENCES `shortlists`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `shortlist_members` ADD CONSTRAINT `shortlist_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `shortlists` ADD CONSTRAINT `shortlists_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
CREATE INDEX `app_errors_last_seen_idx` ON `app_errors` (`last_seen_at`);
CREATE INDEX `follows_target_idx` ON `follows` (`kind`,`target_id`);
CREATE INDEX `notifications_user_idx` ON `notifications` (`user_id`,`created_at`);
CREATE INDEX `push_subscriptions_user_idx` ON `push_subscriptions` (`user_id`);
CREATE INDEX `shared_links_user_idx` ON `shared_links` (`user_id`);
CREATE INDEX `shortlist_comments_list_idx` ON `shortlist_comments` (`shortlist_id`,`created_at`);
CREATE INDEX `shortlist_members_user_idx` ON `shortlist_members` (`user_id`);
CREATE INDEX `shortlists_owner_idx` ON `shortlists` (`owner_id`);

