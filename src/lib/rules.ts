import type { GameId } from "./games";

export type Difficulty = "easy" | "medium" | "hard";
export const RULES_VERSION: Record<GameId, number> = {
  reaction: 1,
  memory: 2,
  aim: 1,
  trivia: 3,
};
export const MEMORY_LIMIT_MS = 120_000;
export const MEMORY_LEAD_MS = 600;
export const MEMORY_TRANSITION_MS = 650;
export const MEMORY_ROUNDS = Array.from({ length: 10 }, (_, round) => ({
  length: round + 3,
  flashMs: 450 - round * 30,
  gapMs: 160 - round * 7,
  points: [30, 40, 50, 60, 80, 100, 120, 140, 170, 210][round],
  inputMs: Math.max(6000, (round + 3) * 1800),
}));
export function memoryPlaybackMs(round: number) {
  const config = MEMORY_ROUNDS[round];
  return MEMORY_LEAD_MS + config.length * (config.flashMs + config.gapMs);
}
export const QUIZ_COUNT = 15;
export const QUIZ_MIX: Record<Difficulty, number> = {
  easy: 8,
  medium: 5,
  hard: 2,
};
export const QUIZ_RULES: Record<
  Difficulty,
  { timeLimitMs: number; maxPoints: number }
> = {
  easy: { timeLimitMs: 10_000, maxPoints: 40 },
  medium: { timeLimitMs: 12_000, maxPoints: 80 },
  hard: { timeLimitMs: 15_000, maxPoints: 140 },
};
