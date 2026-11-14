CREATE TABLE `household_months` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`period` text NOT NULL,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `month_room_period` ON `household_months` (`room_id`,`period`);