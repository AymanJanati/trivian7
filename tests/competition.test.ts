import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeName } from "@/lib/nickname";
import {
  aimScore,
  better,
  memoryScore,
  reactionScore,
  triviaScore,
  WORST,
} from "@/lib/scoring";
import {
  abandonGame,
  answerQuestion,
  finishGame,
  openQuestion,
  startGame,
} from "@/lib/competition";
import { transaction } from "@/db/store";
import { checkAdmin, passwordMatches, signAdmin } from "@/lib/admin-auth";
import { chooseQuestions, questions } from "@/lib/trivia/questions.server";
import { environment } from "@/lib/env";
import { GAME_IDS, type GameSession } from "@/lib/games";
import {
  MEMORY_ROUNDS,
  MEMORY_TRANSITION_MS,
  memoryPlaybackMs,
  QUIZ_RULES,
  type Difficulty,
} from "@/lib/rules";
import { generateMemorySequences } from "@/lib/memory.server";
const memoryChallenges = MEMORY_ROUNDS.map((round, r) =>
  Array.from({ length: round.length }, (_, i) => (i + r) % 9),
);
const difficultyMix: Difficulty[] = [
  ...Array(5).fill("easy"),
  ...Array(5).fill("medium"),
  ...Array(5).fill("hard"),
];
const finishReaction = (s: GameSession, ms = 300) =>
  finishGame(s.gameId, s.id, s.token, { trials: [ms, ms, ms, ms, ms] });
beforeEach(async () => {
  vi.useRealTimers();
  process.env.DEMO_MODE = "true";
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
  for (const game of GAME_IDS) await transaction(game, (repo) => repo.remove());
});
describe("nicknames", () => {
  it("normalizes NFKC, case and whitespace while retaining display capitalization", () => {
    expect(normalizeName("  Ｎova   7 ")).toEqual({
      displayName: "Nova 7",
      normalizedName: "nova 7",
    });
    expect(normalizeName("NOVA").normalizedName).toBe("nova");
    expect(normalizeName("ستار 7").displayName).toBe("ستار 7");
  });
  it.each(["", "a", "   ", "bad<script>", "x.y", "__", "12345678901234567"])(
    "rejects invalid tag %s",
    (value) => expect(() => normalizeName(value)).toThrow(),
  );
  it("keeps game namespaces independent and confirms only completed names", async () => {
    const first = await startGame("reaction", "Nova", false);
    await startGame("reaction", "nova", false);
    await new Promise((r) => setTimeout(r, 1501));
    await finishReaction(first);
    await expect(startGame("reaction", " NOVA ", false)).rejects.toMatchObject({
      status: 409,
      code: "TAG_EXISTS",
    });
    await expect(startGame("memory", "nova", false)).resolves.toMatchObject({
      gameId: "memory",
    });
    await expect(startGame("reaction", "Nova", true)).resolves.toMatchObject({
      displayName: "Nova",
    });
  });
  it("does not reserve abandoned names", async () => {
    const s = await startGame("reaction", "Nova", false);
    await abandonGame("reaction", s.id, s.token);
    await expect(startGame("reaction", "nova", false)).resolves.toBeDefined();
    await expect(finishReaction(s)).rejects.toMatchObject({ status: 410 });
  });
});
describe("exact scoring", () => {
  it("scores reaction, false starts, implausible input and timeouts", () => {
    expect(reactionScore({ trials: [150, 150, 150, 150, 150] })).toEqual({
      score: 1000,
      tiebreakMs: 150,
    });
    expect(reactionScore({ trials: [-1, 99, 1500, -1, 650] })).toEqual({
      score: 0,
      tiebreakMs: 1075,
    });
    expect(reactionScore({ trials: [-1, -1, -1, -1, -1] }).tiebreakMs).toBe(
      WORST,
    );
    expect(() => reactionScore({ trials: [NaN, 0, 0, 0, 0] })).toThrow();
  });
  it("scores only completed fresh memory rounds and uses last successful time", () => {
    const first = memoryPlaybackMs(0);
    const second = first + 300 + MEMORY_TRANSITION_MS + memoryPlaybackMs(1);
    expect(
      memoryScore(
        {
          inputs: [
            { tile: 0, at: first + 100 },
            { tile: 1, at: first + 200 },
            { tile: 2, at: first + 300 },
            { tile: 0, at: second + 100 },
          ],
          elapsedMs: second + 100,
        },
        memoryChallenges,
      ),
    ).toEqual({ score: 30, tiebreakMs: first + 300 });
    expect(
      memoryScore(
        { inputs: [{ tile: 8, at: first + 100 }], elapsedMs: first + 100 },
        memoryChallenges,
      ),
    ).toEqual({ score: 0, tiebreakMs: WORST });
  });
  it("awards 1000 only after all ten increasingly fast memory rounds", () => {
    let time = 0;
    const inputs = [];
    for (let r = 0; r < MEMORY_ROUNDS.length; r++) {
      time += (r === 0 ? 0 : MEMORY_TRANSITION_MS) + memoryPlaybackMs(r);
      for (const tile of memoryChallenges[r])
        inputs.push({ tile, at: (time += 100) });
    }
    expect(
      memoryScore({ inputs, elapsedMs: time }, memoryChallenges).score,
    ).toBe(1000);
    expect(MEMORY_ROUNDS.map((r) => r.length)).toEqual([
      3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(
      MEMORY_ROUNDS.every(
        (r, i) => i === 0 || r.flashMs < MEMORY_ROUNDS[i - 1].flashMs,
      ),
    ).toBe(true);
  });
  it("generates independent patterns without adjacent duplicate tiles or reused openings", () => {
    for (let trial = 0; trial < 20; trial++) {
      const sequences = generateMemorySequences();
      sequences.forEach((sequence, r) => {
        expect(sequence).toHaveLength(MEMORY_ROUNDS[r].length);
        expect(
          sequence.every(
            (tile, i) =>
              tile >= 0 && tile <= 8 && (i === 0 || tile !== sequence[i - 1]),
          ),
        ).toBe(true);
        if (r)
          expect(sequence.slice(0, 3)).not.toEqual(
            sequences[r - 1].slice(0, 3),
          );
      });
    }
  });
  it("rejects early memory inputs, expired input windows and input after a mistake", () => {
    expect(() =>
      memoryScore(
        { inputs: [{ tile: 0, at: 5 }], elapsedMs: 5 },
        memoryChallenges,
      ),
    ).toThrow();
    const at = memoryPlaybackMs(0) + 100;
    expect(() =>
      memoryScore(
        {
          inputs: [
            { tile: 8, at },
            { tile: 0, at: at + 100 },
          ],
          elapsedMs: at + 100,
        },
        memoryChallenges,
      ),
    ).toThrow();
    const late = memoryPlaybackMs(0) + MEMORY_ROUNDS[0].inputMs + 1;
    expect(() =>
      memoryScore(
        { inputs: [{ tile: 0, at: late }], elapsedMs: late },
        memoryChallenges,
      ),
    ).toThrow();
  });
  it("scores aim completion and timeout; validates event ordering", () => {
    expect(
      aimScore({
        hits: Array.from({ length: 20 }, (_, i) => (i + 1) * 500),
        misses: 1,
        elapsedMs: 10000,
      }),
    ).toEqual({ score: 933, tiebreakMs: 10000 });
    expect(aimScore({ hits: [100, 200], misses: 3, elapsedMs: 30000 })).toEqual(
      { score: 80, tiebreakMs: 3 },
    );
    expect(() =>
      aimScore({ hits: [200, 100], misses: 0, elapsedMs: 30000 }),
    ).toThrow();
    expect(() =>
      aimScore({ hits: [100], misses: 0, elapsedMs: 1000 }),
    ).toThrow();
  });
  it("weights quiz difficulty, rewards accuracy and reserves 1000 for a perfect fast run", () => {
    const answers = difficultyMix.map(() => ({
      correct: true,
      elapsedMs: 0,
      timedOut: false,
    }));
    expect(triviaScore(answers, difficultyMix)).toEqual({
      score: 1000,
      tiebreakMs: 0,
    });
    expect(
      triviaScore(
        answers.map((a, i) => ({
          ...a,
          elapsedMs: QUIZ_RULES[difficultyMix[i]].timeLimitMs - 1,
        })),
        difficultyMix,
      ).score,
    ).toBe(800);
    expect(
      triviaScore(
        answers.map((a) => ({ ...a, correct: false })),
        difficultyMix,
      ).score,
    ).toBe(0);
    expect(
      triviaScore(
        answers.map((a, i) => ({ ...a, correct: i >= 10 })),
        difficultyMix,
      ).score,
    ).toBe(475);
    expect(() =>
      triviaScore(answers.slice(0, 5), difficultyMix.slice(0, 5)),
    ).toThrow();
    expect(() => triviaScore(answers, Array(15).fill("easy"))).toThrow();
  });
  it("compares equal score tiebreaks and never regresses", () => {
    expect(
      better(
        { score: 500, tiebreakMs: 150 },
        { bestScore: 500, bestTiebreakMs: 200 },
      ),
    ).toBe(true);
    expect(
      better(
        { score: 499, tiebreakMs: 100 },
        { bestScore: 500, bestTiebreakMs: 200 },
      ),
    ).toBe(false);
  });
});
describe("atomic finish and moderation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
  });
  it("archives old Memory and Trivia scores without changing Reaction or Aim boards", async () => {
    const now = new Date().toISOString();
    for (const gameId of GAME_IDS) {
      await transaction(
        gameId,
        (repo) =>
          repo.saveEntry({
            id: crypto.randomUUID(),
            gameId,
            rulesVersion: 1,
            displayName: "Legacy",
            normalizedName: "legacy",
            bestScore: 1000,
            bestTiebreakMs: 100,
            attemptCount: 1,
            bestAchievedAt: now,
            createdAt: now,
            updatedAt: now,
          }),
        1,
      );
    }
    for (const game of ["memory", "trivia"] as const) {
      expect(await transaction(game, (repo) => repo.board())).toHaveLength(0);
      await expect(startGame(game, "Legacy", false)).resolves.toMatchObject({
        displayName: "Legacy",
      });
      await transaction(game, (repo) => repo.remove());
      expect(await transaction(game, (repo) => repo.board(), 1)).toHaveLength(
        1,
      );
    }
    for (const game of ["reaction", "aim"] as const)
      expect(await transaction(game, (repo) => repo.board())).toHaveLength(1);
  });
  it("increments attempts and preserves the personal best through replays", async () => {
    let s = await startGame("reaction", "Nova", false);
    vi.advanceTimersByTime(5000);
    expect((await finishReaction(s, 300)).score).toBe(700);
    s = await startGame("reaction", "Nova", true);
    vi.advanceTimersByTime(5000);
    expect((await finishReaction(s, 400)).best).toBe(700);
    s = await startGame("reaction", "Nova", true);
    vi.advanceTimersByTime(5000);
    expect((await finishReaction(s, 250)).best).toBe(800);
    const board = await transaction("reaction", (repo) => repo.board());
    expect(board).toHaveLength(1);
    expect(board[0].attemptCount).toBe(3);
  });
  it("makes concurrent retry submissions idempotent", async () => {
    const s = await startGame("reaction", "Nova", false);
    vi.advanceTimersByTime(5000);
    const results = await Promise.all([
      finishReaction(s),
      finishReaction(s),
      finishReaction(s),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(
      (await transaction("reaction", (repo) => repo.board()))[0].attemptCount,
    ).toBe(1);
  });
  it("retains a collided score for retry under a new name", async () => {
    const a = await startGame("reaction", "Nova", false),
      b = await startGame("reaction", "nova", false);
    vi.advanceTimersByTime(5000);
    await finishReaction(a);
    await expect(finishReaction(b, 250)).rejects.toMatchObject({
      code: "NAME_COLLISION",
    });
    expect(
      await finishGame(
        "reaction",
        b.id,
        b.token,
        { trials: [250, 250, 250, 250, 250] },
        "Orion",
      ),
    ).toMatchObject({ score: 800, displayName: "Orion" });
    expect(await transaction("reaction", (repo) => repo.board())).toHaveLength(
      2,
    );
  });
  it("checks tokens, expiry, numeric bounds and ignores forged score", async () => {
    const s = await startGame("reaction", "Nova", false);
    vi.advanceTimersByTime(5000);
    await expect(
      finishGame("reaction", s.id, "a".repeat(64), { score: 9999 }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      finishGame("reaction", s.id, s.token, { score: 9999 }),
    ).rejects.toThrow();
    vi.advanceTimersByTime(5 * 60000);
    await expect(finishReaction(s)).rejects.toMatchObject({ status: 410 });
  });
  it("rolls back failed completion without consuming the session", async () => {
    const s = await startGame("reaction", "Nova", false);
    vi.advanceTimersByTime(5000);
    await expect(
      finishGame("reaction", s.id, s.token, { trials: [-50] }),
    ).rejects.toThrow();
    await expect(finishReaction(s)).resolves.toMatchObject({ score: 700 });
  });
  it("isolates deletion and resets by game, invalidating active sessions", async () => {
    const a = await startGame("reaction", "Nova", false);
    const b = await startGame("aim", "Nova", false);
    vi.advanceTimersByTime(30000);
    await finishReaction(a);
    await finishGame("aim", b.id, b.token, {
      hits: [],
      misses: 0,
      elapsedMs: 30000,
    });
    const pending = await startGame("reaction", "Other", false);
    await transaction("reaction", (repo) => repo.remove("nova"));
    expect(await transaction("aim", (repo) => repo.board())).toHaveLength(1);
    await transaction("reaction", (repo) => repo.remove());
    await expect(finishReaction(pending)).rejects.toMatchObject({
      status: 403,
    });
    expect(await transaction("aim", (repo) => repo.board())).toHaveLength(1);
  });
});
describe("server-only trivia protocol", () => {
  it("keeps the original bank and draws 15 unique, balanced questions from 90", () => {
    expect(questions).toHaveLength(90);
    expect(new Set(questions.map((q) => q.id)).size).toBe(90);
    for (const q of questions) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options.map((o) => o.text)).size).toBe(4);
      expect(q.options.filter((o) => o.id === q.correctOptionId)).toHaveLength(
        1,
      );
    }
    for (let i = 0; i < 20; i++) {
      const selection = chooseQuestions();
      expect(selection).toHaveLength(15);
      expect(new Set(selection.map((q) => q.id)).size).toBe(15);
      expect(selection.map((q) => q.difficulty)).toEqual(difficultyMix);
      for (let tier = 0; tier < 3; tier++)
        expect(
          new Set(
            selection.slice(tier * 5, tier * 5 + 5).map((q) => q.category),
          ).size,
        ).toBe(5);
    }
  });
  it("hides keys, grades server-side, locks answers and counts timeouts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
    const s = await startGame("trivia", "Nova", false);
    for (let i = 0; i < 15; i++) {
      const q = await openQuestion("trivia", s.id, s.token);
      expect(q).not.toHaveProperty("correctOptionId");
      expect(q).not.toHaveProperty("explanation");
      if ("complete" in q) throw new Error("Unexpected end");
      const actual = questions.find((item) => item.id === q.id)!;
      vi.advanceTimersByTime(i === 14 ? q.timeLimitMs + 1 : 1000);
      const a = await answerQuestion(
        "trivia",
        s.id,
        s.token,
        q.id,
        actual.correctOptionId,
      );
      expect(a.correct).toBe(i !== 14);
      expect(
        await answerQuestion(
          "trivia",
          s.id,
          s.token,
          q.id,
          q.options.find((o) => o.id !== actual.correctOptionId)!.id,
        ),
      ).toEqual(a);
      vi.advanceTimersByTime(700);
    }
    const result = await finishGame("trivia", s.id, s.token, { score: 9999 });
    expect(result.score).toBe(891);
  });
});
describe("organizer security and production safety", () => {
  it("expires signed cookies and rejects tampering", () => {
    const cookie = signAdmin(1000);
    expect(checkAdmin(cookie, 2000)).toBe(true);
    expect(checkAdmin(cookie, 1000 + 8 * 3600000)).toBe(false);
    expect(checkAdmin(cookie.replace(/.$/, "!"), 2000)).toBe(false);
    expect(passwordMatches("local-arcade-demo")).toBe(true);
    expect(passwordMatches("bad")).toBe(false);
  });
  it("forbids cloud demo and requires real credentials", () => {
    process.env.VERCEL = "1";
    expect(() => environment()).toThrow(/local only/);
    delete process.env.VERCEL;
    process.env.DEMO_MODE = "false";
    const database = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(() => environment()).toThrow(/DATABASE_URL/);
    if (database) process.env.DATABASE_URL = database;
  });
});
