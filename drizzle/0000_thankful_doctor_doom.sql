CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"game_id" text NOT NULL,
	"display_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"score" integer NOT NULL,
	"tiebreak_ms" integer NOT NULL,
	"attempt_data" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "attempt_score" CHECK ("attempts"."score" between 0 and 1000),
	CONSTRAINT "attempt_game_check" CHECK ("attempts"."game_id" in ('reaction','memory','aim','trivia'))
);
--> statement-breakpoint
CREATE TABLE "leaderboard_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" text NOT NULL,
	"display_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"best_score" integer NOT NULL,
	"best_tiebreak_ms" integer NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"best_achieved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "entry_game" CHECK ("leaderboard_entries"."game_id" in ('reaction','memory','aim','trivia')),
	CONSTRAINT "entry_score" CHECK ("leaderboard_entries"."best_score" between 0 and 1000)
);
--> statement-breakpoint
CREATE TABLE "request_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" text NOT NULL,
	"display_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"session_token_hash" text NOT NULL,
	"session_data" jsonb NOT NULL,
	"state" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "session_game" CHECK ("game_sessions"."game_id" in ('reaction','memory','aim','trivia')),
	CONSTRAINT "session_state" CHECK ("game_sessions"."state" in ('started','finished','abandoned'))
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_session_unique" ON "attempts" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "attempt_game" ON "attempts" USING btree ("game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_name_unique" ON "leaderboard_entries" USING btree ("game_id","normalized_name");--> statement-breakpoint
CREATE INDEX "rank_index" ON "leaderboard_entries" USING btree ("game_id","best_score","best_tiebreak_ms","best_achieved_at");--> statement-breakpoint
CREATE INDEX "session_game_expiry" ON "game_sessions" USING btree ("game_id","expires_at");