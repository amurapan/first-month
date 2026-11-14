CREATE TABLE `product_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`role` text NOT NULL,
	`kind` text NOT NULL,
	`screen` text NOT NULL,
	`message` text NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `feedback_room_role` ON `product_feedback` (`room_id`,`role`,`created_at`);