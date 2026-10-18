import { z } from "zod";
import {
  MEMORY_LIMIT_MS,
  MEMORY_ROUNDS,
  MEMORY_TRANSITION_MS,
  memoryPlaybackMs,
  QUIZ_COUNT,
  QUIZ_RULES,
  type Difficulty,
} from "./rules";
export const WORST = 2147483647;
const ms = z.number().finite().int().nonnegative();
export const reactionData = z.object({
  trials: z.array(z.number().finite().min(-1).max(1500)).length(5),
});
export const memoryData = z.object({
  inputs: z
    .array(z.object({ tile: z.number().int().min(0).max(8), at: ms }))
    .max(MEMORY_ROUNDS.reduce((sum, round) => sum + round.length, 0)),
  elapsedMs: ms.max(MEMORY_LIMIT_MS),
});
export const aimData = z.object({
  hits: z.array(ms.max(30000)).max(20),
  misses: z.number().int().min(0).max(10000),
  elapsedMs: ms.max(30000),
});
export function reactionScore(data: z.infer<typeof reactionData>) {
  const trials = reactionData.parse(data).trials;
  const valid = trials.filter((t) => t >= 100 && t <= 1500);
  return {
    score: trials.reduce(
      (sum, t) =>
        sum +
        (t >= 100
          ? Math.max(0, Math.min(200, Math.round(((650 - t) / 500) * 200)))
          : 0),
      0,
    ),
    tiebreakMs: valid.length
      ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length)
      : WORST,
  };
}
export function memoryScore(
  raw: z.infer<typeof memoryData>,
  sequences: number[][],
) {
  const data = memoryData.parse(raw);
  if (
    sequences.length !== MEMORY_ROUNDS.length ||
    sequences.some((s, i) => s.length !== MEMORY_ROUNDS[i].length)
  )
    throw new Error("Invalid memory challenge.");
  let cursor = 0,
    score = 0,
    lastSuccess = WORST,
    previous = 0;
  for (let round = 0; round < MEMORY_ROUNDS.length; round++) {
    const earliest =
      (round === 0 ? 0 : previous + MEMORY_TRANSITION_MS) +
      memoryPlaybackMs(round);
    for (let i = 0; i < MEMORY_ROUNDS[round].length; i++) {
      const input = data.inputs[cursor++];
      if (!input) return { score, tiebreakMs: lastSuccess };
      if (
        input.at < Math.max(earliest, previous) ||
        input.at > data.elapsedMs ||
        input.at > MEMORY_LIMIT_MS ||
        input.at > earliest + MEMORY_ROUNDS[round].inputMs
      )
        throw new Error("Invalid memory timing.");
      previous = input.at;
      if (input.tile !== sequences[round][i]) {
        if (cursor !== data.inputs.length)
          throw new Error("Inputs after wrong tile.");
        return { score, tiebreakMs: lastSuccess };
      }
    }
    score += MEMORY_ROUNDS[round].points;
    lastSuccess = previous;
  }
  if (cursor !== data.inputs.length) throw new Error("Extra memory inputs.");
  return { score, tiebreakMs: lastSuccess };
}
export function aimScore(raw: z.infer<typeof aimData>) {
  const data = aimData.parse(raw);
  if (
    data.hits.some(
      (t, i) => t > data.elapsedMs || (i > 0 && t - data.hits[i - 1] < 50),
    )
  )
    throw new Error("Invalid target timing.");
  if (data.hits.length < 20 && data.elapsedMs < 29900)
    throw new Error("Incomplete aim run.");
  if (data.hits.length === 20 && data.elapsedMs !== data.hits[19])
    throw new Error("Completion time mismatch.");
  return {
    score:
      data.hits.length * 40 +
      (data.hits.length === 20
        ? Math.round(200 * Math.max(0, (30000 - data.elapsedMs) / 30000))
        : 0),
    tiebreakMs: data.hits.length === 20 ? data.elapsedMs : data.misses,
  };
}
export function triviaScore(
  answers: { correct: boolean; elapsedMs: number; timedOut: boolean }[],
  difficulties: Difficulty[],
) {
  if (answers.length !== QUIZ_COUNT || difficulties.length !== QUIZ_COUNT)
    throw new Error("Complete all fifteen questions.");
  if (
    ["easy", "medium", "hard"].some(
      (d) => difficulties.filter((value) => value === d).length !== 5,
    )
  )
    throw new Error("Invalid quiz difficulty mix.");
  for (const [index, answer] of answers.entries()) {
    if (
      !Number.isInteger(answer.elapsedMs) ||
      answer.elapsedMs < 0 ||
      answer.elapsedMs > QUIZ_RULES[difficulties[index]].timeLimitMs
    )
      throw new Error("Invalid quiz timing.");
  }
  return {
    score: answers.reduce(
      (sum, a, i) =>
        sum +
        (a.correct && !a.timedOut
          ? Math.round(
              QUIZ_RULES[difficulties[i]].maxPoints *
                (0.8 +
                  0.2 *
                    (1 -
                      a.elapsedMs / QUIZ_RULES[difficulties[i]].timeLimitMs)),
            )
          : 0),
      0,
    ),
    tiebreakMs: answers
      .filter((a) => !a.timedOut)
      .reduce((sum, a) => sum + a.elapsedMs, 0),
  };
}
export function better(
  next: { score: number; tiebreakMs: number },
  entry: { bestScore: number; bestTiebreakMs: number },
) {
  return (
    next.score > entry.bestScore ||
    (next.score === entry.bestScore && next.tiebreakMs < entry.bestTiebreakMs)
  );
}
