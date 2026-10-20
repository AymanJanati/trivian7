import { describe, it, expect, beforeEach, vi } from "vitest";
import { generateChallenges, challengeScore } from "@/lib/new-challenges";
import { ultraRankings } from "@/lib/ultra";
import { ACTIVE_GAME_IDS, GAME_IDS, type Entry } from "@/lib/games";
import { startGame, finishGame } from "@/lib/competition";
import { transaction } from "@/db/store";

beforeEach(async () => {
  process.env.DEMO_MODE = "true";
  delete process.env.VERCEL;
  for (const game of GAME_IDS) await transaction(game, (repo) => repo.remove());
});
describe("new challenge scoring", () => {
  it.each(["color", "numbers"])(
    "%s progresses and rewards accuracy and speed",
    (game) => {
      const challenges = generateChallenges(game);
      expect(challenges[19].limitMs).toBeLessThan(challenges[0].limitMs);
      const events = challenges.map((c, i) => ({
        choice: c.answer,
        at: (i + 1) * 100,
      }));
      expect(
        challengeScore(game, { events, elapsedMs: 2000 }, challenges).score,
      ).toBeGreaterThan(950);
      expect(
        challengeScore(
          game,
          {
            events: events.map((e) => ({ ...e, choice: (e.choice + 1) % 4 })),
            elapsedMs: 2000,
          },
          challenges,
        ).score,
      ).toBe(0);
      expect(() =>
        challengeScore(game, { events: [], elapsedMs: 0 }, challenges),
      ).toThrow();
      expect(() =>
        challengeScore(
          game,
          { events: events.map((e) => ({ ...e, at: 0 })), elapsedMs: 0 },
          challenges,
        ),
      ).toThrow();
      expect(() =>
        challengeScore(
          game,
          { events: [...events].reverse(), elapsedMs: 2000 },
          challenges,
        ),
      ).toThrow();
    },
  );
  it("rhythm accelerates, tightens windows and cannot score the same note twice", () => {
    const track = generateChallenges("rhythm");
    expect(track[59].at - track[58].at).toBeLessThan(track[1].at - track[0].at);
    expect(track[59].limitMs).toBeLessThan(track[0].limitMs);
    const events = track.map((n) => ({ choice: n.lane, at: n.at }));
    const elapsedMs = track[59].at + 350;
    expect(challengeScore("rhythm", { events, elapsedMs }, track).score).toBe(
      1000,
    );
    expect(
      challengeScore(
        "rhythm",
        { events: events.flatMap((e) => [e, e]), elapsedMs },
        track,
      ).score,
    ).toBeLessThan(1000);
    expect(() =>
      challengeScore("rhythm", { events: [], elapsedMs: 100 }, track),
    ).toThrow();
  });
  it.each(["color", "numbers", "rhythm"] as const)(
    "%s saves an idempotent server-scored result without exposing answer keys",
    async (game) => {
      vi.useFakeTimers();
      try {
        const session = await startGame(game, "NewNova", false);
        expect(session.challenges?.length).toBe(game === "rhythm" ? 60 : 20);
        expect(session.challenges?.[0]).not.toHaveProperty("answer");
        const track = session.challenges!;
        const events =
          game === "rhythm"
            ? track.map((n) => ({ choice: n.lane, at: n.at }))
            : track.map((_, i) => ({ choice: 0, at: (i + 1) * 100 }));
        const elapsedMs = game === "rhythm" ? track.at(-1)!.at + 350 : 2000;
        vi.advanceTimersByTime(elapsedMs);
        const result = await finishGame(game, session.id, session.token, {
          events,
          elapsedMs,
        });
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(1000);
        expect(
          await finishGame(game, session.id, session.token, {
            events,
            elapsedMs,
          }),
        ).toEqual(result);
      } finally {
        vi.useRealTimers();
      }
    },
  );
});
it("Ultra requires all six games, combines normalized tags and excludes retired scores", () => {
  const boards = ACTIVE_GAME_IDS.map(
    (game, i) =>
      [
        {
          gameId: game,
          normalizedName: "nova",
          displayName: i % 2 ? "NOVA" : "Nova",
          bestScore: 900,
          bestAchievedAt: "2026-10-20",
        },
      ] as Entry[],
  );
  expect(ultraRankings(boards.slice(1))).toEqual([]);
  expect(
    ultraRankings([
      ...boards,
      [{ ...boards[0][0], gameId: "trivia", bestScore: 1000 }],
    ])[0].score,
  ).toBe(5400);
});
