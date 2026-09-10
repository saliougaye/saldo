CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`sync_state` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`institution` text,
	`opening_balance` integer NOT NULL,
	`include_in_spendable` integer NOT NULL,
	`color_index` integer NOT NULL,
	`icon` text NOT NULL,
	`credit_close_day` integer,
	`credit_charge_day` integer,
	`credit_payment_account_id` text,
	`archived_at` text,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `accounts_pending` ON `accounts` (`sync_state`) WHERE sync_state = 1;--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`sync_state` integer DEFAULT 1 NOT NULL,
	`transaction_id` text NOT NULL,
	`mime_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`width` integer,
	`height` integer,
	`local_uri` text
);
--> statement-breakpoint
CREATE INDEX `attachments_transaction` ON `attachments` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `attachments_pending` ON `attachments` (`sync_state`) WHERE sync_state = 1;--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`sync_state` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`category_ids` text NOT NULL,
	`amount` integer NOT NULL,
	`period` text NOT NULL,
	`alert_threshold` integer,
	`rollover` integer NOT NULL,
	`icon` text NOT NULL,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `budgets_pending` ON `budgets` (`sync_state`) WHERE sync_state = 1;--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`sync_state` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL,
	`direction` text NOT NULL,
	`parent_id` text,
	`icon` text NOT NULL,
	`color_index` integer NOT NULL,
	`archived_at` text,
	`sort_order` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `categories_parent` ON `categories` (`parent_id`);--> statement-breakpoint
CREATE INDEX `categories_pending` ON `categories` (`sync_state`) WHERE sync_state = 1;--> statement-breakpoint
CREATE TABLE `kv` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recurrences` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`sync_state` integer DEFAULT 1 NOT NULL,
	`frequency` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`template` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `recurrences_pending` ON `recurrences` (`sync_state`) WHERE sync_state = 1;--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`sync_state` integer DEFAULT 1 NOT NULL,
	`period_kind` text NOT NULL,
	`cycle_start_day` integer NOT NULL,
	`currency` text NOT NULL,
	`language` text NOT NULL,
	`theme` text NOT NULL,
	`onboarding_completed_at` text
);
--> statement-breakpoint
CREATE INDEX `settings_pending` ON `settings` (`sync_state`) WHERE sync_state = 1;--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`sync_state` integer DEFAULT 1 NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tags_pending` ON `tags` (`sync_state`) WHERE sync_state = 1;--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`sync_state` integer DEFAULT 1 NOT NULL,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`date` text NOT NULL,
	`account_id` text NOT NULL,
	`to_account_id` text,
	`category_id` text,
	`description` text NOT NULL,
	`note` text,
	`tag_ids` text NOT NULL,
	`exclude_from_totals` integer NOT NULL,
	`recurrence_id` text
);
--> statement-breakpoint
CREATE INDEX `transactions_date` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_account_date` ON `transactions` (`account_id`,`date`);--> statement-breakpoint
CREATE INDEX `transactions_category_date` ON `transactions` (`category_id`,`date`);--> statement-breakpoint
CREATE INDEX `transactions_recurrence` ON `transactions` (`recurrence_id`);--> statement-breakpoint
CREATE INDEX `transactions_pending` ON `transactions` (`sync_state`) WHERE sync_state = 1;