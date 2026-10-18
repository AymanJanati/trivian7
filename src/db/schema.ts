import {
  pgTable,
  text,
  uuid,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { Entry, GameId, Result } from "@/lib/games";
import type { Question } from "@/lib/trivia/questions.server";
export interface SessionData {
  returningEntryId?: string;
  rulesVersion?: number;
  sequences?: number[][];
  questions?: Question[];
  answers?: {
    correct: boolean;
    elapsedMs: number;
    timedOut: boolean;
    optionId: string | null;
  }[];
  questionOpenedAt?: number;
  questionReadyAt?: number;
  result?: Result;
}
export const entries = pgTable(
  "leaderboard_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: text("game_id").$type<GameId>().notNull(),
    rulesVersion: integer("rules_version").notNull().default(1),
    displayName: text("display_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    bestScore: integer("best_score").notNull(),
    bestTiebreakMs: integer("best_tiebreak_ms").notNull(),
    attemptCount: integer("attempt_count").notNull().default(1),
    bestAchievedAt: timestamp("best_achieved_at", {
      withTimezone: true,
      mode: "string",
    })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("game_name_unique").on(
      t.gameId,
      t.rulesVersion,
      t.normalizedName,
    ),
    index("rank_index").on(
      t.gameId,
      t.bestScore,
      t.bestTiebreakMs,
      t.bestAchievedAt,
    ),
    check(
      "entry_game",
      sql`${t.gameId} in ('reaction','memory','aim','trivia')`,
    ),
    check("entry_score", sql`${t.bestScore} between 0 and 1000`),
  ],
);
export const sessions = pgTable(
  "game_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: text("game_id").$type<GameId>().notNull(),
    displayName: text("display_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    tokenHash: text("session_token_hash").notNull(),
    data: jsonb("session_data").$type<SessionData>().notNull(),
    state: text("state")
      .$type<"started" | "finished" | "abandoned">()
      .notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    finishedAt: timestamp("finished_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (t) => [
    index("session_game_expiry").on(t.gameId, t.expiresAt),
    check(
      "session_game",
      sql`${t.gameId} in ('reaction','memory','aim','trivia')`,
    ),
    check(
      "session_state",
      sql`${t.state} in ('started','finished','abandoned')`,
    ),
  ],
);
export const attempts = pgTable(
  "attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    gameId: text("game_id").$type<GameId>().notNull(),
    displayName: text("display_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    score: integer("score").notNull(),
    tiebreakMs: integer("tiebreak_ms").notNull(),
    data: jsonb("attempt_data").notNull(),
    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (t) => [
    uniqueIndex("attempt_session_unique").on(t.sessionId),
    index("attempt_game").on(t.gameId),
    check("attempt_score", sql`${t.score} between 0 and 1000`),
    check(
      "attempt_game_check",
      sql`${t.gameId} in ('reaction','memory','aim','trivia')`,
    ),
  ],
);
export const limits = pgTable("request_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: timestamp("reset_at", {
    withTimezone: true,
    mode: "string",
  }).notNull(),
});
export type Session = typeof sessions.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type BoardEntry = Entry;
