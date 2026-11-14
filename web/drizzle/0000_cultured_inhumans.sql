CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`token_a` text NOT NULL,
	`token_b` text,
	`invite` text,
	`data` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
