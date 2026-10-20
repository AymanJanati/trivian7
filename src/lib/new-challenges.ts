import { z } from "zod";

export const COLORS = ["RED", "BLUE", "GREEN", "GOLD"];
export const INKS = ["#d92e49", "#087be0", "#18864b", "#9c6700"];
export type PublicChallenge = {
  prompt: string;
  options: string[];
  ink: number;
  limitMs: number;
  at: number;
  lane: number;
};
export type Challenge = PublicChallenge & { answer: number };
export function generateChallenges(
  game: string,
  random = Math.random,
): Challenge[] {
  const int = (n: number) => Math.floor(random() * n);
  let at = 1800;
  return Array.from({ length: game === "rhythm" ? 60 : 20 }, (_, i) => {
    const ink = int(4);
    let answer = ink,
      prompt = COLORS[i < 4 ? ink : (ink + 1 + int(3)) % 4],
      options = [...COLORS];
    if (game === "numbers") {
      const a = 2 + int(8 + i * 3),
        b = 2 + int(8 + i);
      const value =
        i < 5 ? a + b : i < 10 ? a - b : i < 15 ? a * b : (a - b) * 3;
      prompt =
        i < 5
          ? `${a} + ${b}`
          : i < 10
            ? `${a} − ${b}`
            : i < 15
              ? `${a} × ${b}`
              : `(${a} − ${b}) × 3`;
      answer = int(4);
      options = Array.from({ length: 4 }, (_, j) =>
        String(value + (j - answer) * (1 + (i % 4))),
      );
    }
    if (game === "rhythm") at += 850 - i * 8;
    return {
      prompt,
      options,
      ink,
      answer,
      lane: int(4),
      at,
      limitMs:
        game === "rhythm"
          ? 180 - i
          : game === "color"
            ? 2200 - i * 75
            : 5000 - i * 160,
    };
  });
}
export const challengeData = z.object({
  events: z
    .array(
      z.object({
        choice: z.number().int().min(0).max(3).nullable(),
        at: z.number().finite().int().nonnegative(),
      }),
    )
    .max(300),
  elapsedMs: z.number().finite().int().min(0).max(120000),
});
export function challengeScore(
  game: string,
  raw: unknown,
  challenges: Challenge[],
) {
  const data = challengeData.parse(raw);
  let previous = 0,
    points = 0;
  for (const event of data.events) {
    if (event.at < previous || event.at > data.elapsedMs)
      throw new Error("Invalid event timing.");
    previous = event.at;
  }
  if (game === "rhythm") {
    if (data.elapsedMs < challenges.at(-1)!.at + 250)
      throw new Error("Track is incomplete.");
    const used = new Set<number>();
    let totalError = 0;
    for (const event of data.events) {
      const index = challenges.findIndex(
        (n, i) =>
          !used.has(i) &&
          n.lane === event.choice &&
          Math.abs(event.at - n.at) <= n.limitMs,
      );
      if (index < 0) {
        points -= 0.3;
        continue;
      }
      used.add(index);
      const note = challenges[index];
      totalError += Math.abs(event.at - note.at);
      points += 1 - (Math.abs(event.at - note.at) / note.limitMs) * 0.6;
    }
    return {
      score: Math.max(
        0,
        Math.min(1000, Math.round((points / challenges.length) * 1000)),
      ),
      tiebreakMs: Math.round(
        totalError + (challenges.length - used.size) * 200,
      ),
    };
  }
  if (data.events.length !== challenges.length)
    throw new Error("Complete every round.");
  previous = 0;
  data.events.forEach((event, i) => {
    const elapsed = event.at - previous,
      c = challenges[i];
    if (elapsed < 80 || elapsed > c.limitMs + 1500)
      throw new Error("Invalid round timing.");
    if (event.choice === null && elapsed < c.limitMs)
      throw new Error("Round has not expired.");
    if (event.choice === c.answer && elapsed < c.limitMs)
      points += 40 + 10 * (1 - Math.max(0, elapsed - 200) / (c.limitMs - 200));
    previous = event.at;
  });
  return { score: Math.round(points), tiebreakMs: data.elapsedMs };
}
