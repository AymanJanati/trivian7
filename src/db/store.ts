import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { connection } from "./index";
import {
  entries,
  sessions,
  attempts,
  limits,
  type Session,
  type Attempt,
} from "./schema";
import type { Entry, GameId } from "@/lib/games";
import { environment } from "@/lib/env";
import { RULES_VERSION } from "@/lib/rules";
export interface Repository {
  board(): Promise<Entry[]>;
  entry(name: string): Promise<Entry | undefined>;
  session(id: string): Promise<Session | undefined>;
  saveSession(row: Session): Promise<void>;
  saveEntry(row: Entry): Promise<void>;
  saveAttempt(row: Attempt): Promise<void>;
  remove(name?: string): Promise<void>;
}
interface MemoryState {
  entries: Entry[];
  sessions: Session[];
  attempts: Attempt[];
  limits: Map<string, { count: number; reset: number }>;
}
const globalStore = globalThis as typeof globalThis & {
  arcadeState?: MemoryState;
  arcadeQueue?: Promise<unknown>;
};
function memory(): MemoryState {
  return (globalStore.arcadeState ??= {
    entries: [],
    sessions: [],
    attempts: [],
    limits: new Map(),
  });
}
export async function transaction<T>(
  game: GameId,
  run: (repo: Repository) => Promise<T>,
  rulesVersion = RULES_VERSION[game],
): Promise<T> {
  if (environment().demo) {
    const task = (globalStore.arcadeQueue ?? Promise.resolve()).then(
      async () => {
        const draft = structuredClone(memory());
        const repo: Repository = {
          board: async () =>
            draft.entries.filter(
              (e) =>
                e.gameId === game && (e.rulesVersion ?? 1) === rulesVersion,
            ),
          entry: async (name) =>
            draft.entries.find(
              (e) =>
                e.gameId === game &&
                (e.rulesVersion ?? 1) === rulesVersion &&
                e.normalizedName === name,
            ),
          session: async (id) =>
            draft.sessions.find(
              (s) =>
                s.gameId === game &&
                (s.data.rulesVersion ?? 1) === rulesVersion &&
                s.id === id,
            ),
          saveSession: async (row) => {
            draft.sessions = draft.sessions.filter((s) => s.id !== row.id);
            draft.sessions.push(row);
          },
          saveEntry: async (row) => {
            draft.entries = draft.entries.filter((e) => e.id !== row.id);
            draft.entries.push(row);
          },
          saveAttempt: async (row) => {
            if (draft.attempts.some((a) => a.sessionId === row.sessionId))
              throw new Error("Duplicate attempt");
            draft.attempts.push(row);
          },
          remove: async (name) => {
            draft.entries = draft.entries.filter(
              (e) =>
                e.gameId !== game ||
                (e.rulesVersion ?? 1) !== rulesVersion ||
                (name !== undefined && e.normalizedName !== name),
            );
            const ids = draft.sessions
              .filter(
                (s) =>
                  s.gameId === game &&
                  (s.data.rulesVersion ?? 1) === rulesVersion &&
                  (name === undefined || s.normalizedName === name),
              )
              .map((s) => s.id);
            draft.sessions = draft.sessions.filter((s) => !ids.includes(s.id));
            draft.attempts = draft.attempts.filter(
              (a) => !ids.includes(a.sessionId),
            );
          },
        };
        const result = await run(repo);
        globalStore.arcadeState = draft;
        return result;
      },
    );
    globalStore.arcadeQueue = task.catch(() => {});
    return task;
  }
  const { db, pool } = connection();
  try {
    return await db.transaction(async (tx) => {
      // All mutations of a game share this lock, including moderation and reset.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${"n7arcade:" + game}))`,
      );
      const entryScope = and(
        eq(entries.gameId, game),
        eq(entries.rulesVersion, rulesVersion),
      );
      const sessionScope = and(
        eq(sessions.gameId, game),
        sql`coalesce((${sessions.data}->>'rulesVersion')::integer, 1) = ${rulesVersion}`,
      );
      const repo: Repository = {
        board: () => tx.select().from(entries).where(entryScope),
        entry: async (name) =>
          (
            await tx
              .select()
              .from(entries)
              .where(and(entryScope, eq(entries.normalizedName, name)))
          )[0],
        session: async (id) =>
          (
            await tx
              .select()
              .from(sessions)
              .where(and(sessionScope, eq(sessions.id, id)))
          )[0],
        saveSession: async (row) => {
          await tx
            .insert(sessions)
            .values(row)
            .onConflictDoUpdate({ target: sessions.id, set: row });
        },
        saveEntry: async (row) => {
          await tx
            .insert(entries)
            .values(row)
            .onConflictDoUpdate({ target: entries.id, set: row });
        },
        saveAttempt: async (row) => {
          await tx.insert(attempts).values(row);
        },
        remove: async (name) => {
          await tx
            .delete(entries)
            .where(
              and(
                entryScope,
                name !== undefined
                  ? eq(entries.normalizedName, name)
                  : undefined,
              ),
            );
          await tx
            .delete(sessions)
            .where(
              and(
                sessionScope,
                name !== undefined
                  ? eq(sessions.normalizedName, name)
                  : undefined,
              ),
            );
        },
      };
      return run(repo);
    });
  } finally {
    await pool.end();
  }
}
export async function rateLimit(
  key: string,
  maximum: number,
  windowMs: number,
) {
  const now = Date.now();
  if (environment().demo) {
    const state = memory();
    let rate = state.limits.get(key);
    if (!rate || rate.reset <= now) {
      rate = { count: 0, reset: now + windowMs };
      state.limits.set(key, rate);
    }
    if (++rate.count > maximum) throw new Error("RATE_LIMIT");
    return;
  }
  const { db, pool } = connection();
  try {
    const [row] = await db
      .insert(limits)
      .values({
        key,
        count: 1,
        resetAt: new Date(now + windowMs).toISOString(),
      })
      .onConflictDoUpdate({
        target: limits.key,
        set: {
          count: sql`case when ${limits.resetAt} <= now() then 1 else ${limits.count}+1 end`,
          resetAt: sql`case when ${limits.resetAt} <= now() then ${new Date(now + windowMs).toISOString()}::timestamptz else ${limits.resetAt} end`,
        },
      })
      .returning();
    if (row.count > maximum) throw new Error("RATE_LIMIT");
  } finally {
    await pool.end();
  }
}
