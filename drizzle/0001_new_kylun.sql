DROP INDEX "game_name_unique";--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD COLUMN "rules_version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "game_name_unique" ON "leaderboard_entries" USING btree ("game_id","rules_version","normalized_name");