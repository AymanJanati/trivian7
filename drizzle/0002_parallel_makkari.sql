ALTER TABLE "attempts" DROP CONSTRAINT "attempt_game_check";--> statement-breakpoint
ALTER TABLE "leaderboard_entries" DROP CONSTRAINT "entry_game";--> statement-breakpoint
ALTER TABLE "game_sessions" DROP CONSTRAINT "session_game";--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempt_game_check" CHECK ("attempts"."game_id" in ('reaction','memory','aim','color','numbers','rhythm','trivia'));--> statement-breakpoint
ALTER TABLE "leaderboard_entries" ADD CONSTRAINT "entry_game" CHECK ("leaderboard_entries"."game_id" in ('reaction','memory','aim','color','numbers','rhythm','trivia'));--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "session_game" CHECK ("game_sessions"."game_id" in ('reaction','memory','aim','color','numbers','rhythm','trivia'));