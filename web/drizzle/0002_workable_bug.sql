CREATE TABLE `household_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `decision_room_updated` ON `household_decisions` (`room_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `household_reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`week` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `review_room_week` ON `household_reviews` (`room_id`,`week`);--> statement-breakpoint
CREATE TABLE `plan_history` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`plan_version` integer NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `history_room_version` ON `plan_history` (`room_id`,`plan_version`);