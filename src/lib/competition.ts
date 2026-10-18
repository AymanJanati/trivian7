import "server-only";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { transaction, type Repository } from "@/db/store";
import type { Session } from "@/db/schema";
import { normalizeName } from "./nickname";
import {
  type Entry,
  type GameId,
  type Result,
  type PublicQuestion,
} from "./games";
import { chooseQuestions } from "./trivia/questions.server";
import { generateMemorySequences } from "./memory.server";
import { RULES_VERSION, QUIZ_COUNT, QUIZ_RULES } from "./rules";
import {
  aimScore,
  better,
  memoryScore,
  reactionScore,
  triviaScore,
  aimData,
  memoryData,
  reactionData,
} from "./scoring";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
export function ranked(rows: Entry[]) {
  return [...rows]
    .sort(
      (a, b) =>
        b.bestScore - a.bestScore ||
        a.bestTiebreakMs - b.bestTiebreakMs ||
        Date.parse(a.bestAchievedAt) - Date.parse(b.bestAchievedAt) ||
        (a.normalizedName < b.normalizedName
          ? -1
          : a.normalizedName > b.normalizedName
            ? 1
            : 0),
    )
    .map((row, i) => ({ ...row, rank: i + 1 }));
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
async function authorized(repo: Repository, id: string, token: string) {
  const session = await repo.session(id);
  const received = hash(token);
  if (
    !session ||
    !timingSafeEqual(Buffer.from(session.tokenHash), Buffer.from(received))
  )
    throw new ApiError(403, "Invalid game session.");
  if (
    session.state !== "finished" &&
    Date.parse(session.expiresAt) < Date.now()
  )
    throw new ApiError(410, "This run expired. Please start a new game.");
  if (session.state === "abandoned")
    throw new ApiError(410, "This run was quit. Start a new game.");
  return session;
}
export async function startGame(game: GameId, raw: string, returning: boolean) {
  const name = normalizeName(raw);
  return transaction(game, async (repo) => {
    const entry = await repo.entry(name.normalizedName);
    if (entry && !returning)
      throw new ApiError(
        409,
        "Tag already on this board. Is it yours?",
        "TAG_EXISTS",
      );
    const token = randomBytes(32).toString("hex"),
      now = Date.now();
    const session: Session = {
      id: randomUUID(),
      gameId: game,
      ...name,
      tokenHash: hash(token),
      state: "started",
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 5 * 60000).toISOString(),
      finishedAt: null,
      data: { returningEntryId: entry?.id, rulesVersion: RULES_VERSION[game] },
    };
    if (game === "memory") session.data.sequences = generateMemorySequences();
    if (game === "trivia") {
      session.data.questions = chooseQuestions();
      session.data.answers = [];
      session.data.questionReadyAt = now;
    }
    await repo.saveSession(session);
    return {
      id: session.id,
      token,
      gameId: game,
      displayName: name.displayName,
      ...(game === "memory" ? { sequences: session.data.sequences } : {}),
    };
  });
}
export async function openQuestion(
  game: GameId,
  id: string,
  token: string,
): Promise<PublicQuestion | { complete: true }> {
  if (game !== "trivia") throw new ApiError(400, "This game has no questions.");
  return transaction(game, async (repo) => {
    const session = await authorized(repo, id, token);
    if (session.state !== "started")
      throw new ApiError(409, "Run already closed.");
    const index = session.data.answers!.length;
    if (index === session.data.questions!.length) return { complete: true };
    const now = Date.now();
    if (now < (session.data.questionReadyAt || 0))
      throw new ApiError(425, "Next question is not ready yet.");
    session.data.questionOpenedAt ??= now;
    await repo.saveSession(session);
    const q = session.data.questions![index];
    const { timeLimitMs, maxPoints } = QUIZ_RULES[q.difficulty];
    return {
      id: q.id,
      category: q.category,
      difficulty: q.difficulty,
      prompt: q.prompt,
      options: q.options,
      timeLimitMs,
      maxPoints,
      total: QUIZ_COUNT,
      remainingMs: Math.max(
        0,
        session.data.questionOpenedAt + timeLimitMs - Date.now(),
      ),
      openedAt: session.data.questionOpenedAt,
      deadline: session.data.questionOpenedAt + timeLimitMs,
      index,
    };
  });
}
export async function answerQuestion(
  game: GameId,
  id: string,
  token: string,
  questionId: string,
  optionId: string | null,
) {
  if (game !== "trivia") throw new ApiError(400, "Not a quiz session.");
  return transaction(game, async (repo) => {
    const session = await authorized(repo, id, token),
      data = session.data;
    const index = data.questions!.findIndex((q) => q.id === questionId),
      q = data.questions![index];
    if (!q) throw new ApiError(400, "Unknown question.");
    // Acknowledge retries without revealing grades or changing the locked answer.
    if (index < data.answers!.length) {
      return { accepted: true, questionId };
    }
    if (
      session.state !== "started" ||
      index !== data.answers!.length ||
      !data.questionOpenedAt
    )
      throw new ApiError(409, "Question is not open.");
    if (optionId !== null && !q.options.some((o) => o.id === optionId))
      throw new ApiError(400, "Unknown answer option.");
    const elapsedMs = Math.max(0, Date.now() - data.questionOpenedAt),
      timeLimitMs = QUIZ_RULES[q.difficulty].timeLimitMs,
      timedOut = elapsedMs >= timeLimitMs;
    if (optionId === null && !timedOut)
      throw new ApiError(400, "Question has not expired.");
    const correct = !timedOut && optionId === q.correctOptionId;
    data.answers!.push({
      correct,
      elapsedMs: Math.min(timeLimitMs, elapsedMs),
      timedOut,
      optionId,
    });
    delete data.questionOpenedAt;
    data.questionReadyAt = Date.now();
    await repo.saveSession(session);
    return { accepted: true, questionId };
  });
}
export async function finishGame(
  game: GameId,
  id: string,
  token: string,
  raw: unknown,
  rename?: string,
): Promise<Result> {
  return transaction(game, async (repo) => {
    const session = await authorized(repo, id, token);
    if (session.state === "finished") return session.data.result!;
    const duration = Date.now() - Date.parse(session.createdAt);
    let score: { score: number; tiebreakMs: number };
    try {
      score =
        game === "reaction"
          ? reactionScore(reactionData.parse(raw))
          : game === "memory"
            ? memoryScore(memoryData.parse(raw), session.data.sequences!)
            : game === "aim"
              ? aimScore(aimData.parse(raw))
              : triviaScore(
                  session.data.answers!,
                  session.data.questions!.map((q) => q.difficulty),
                );
    } catch (e) {
      throw new ApiError(
        400,
        e instanceof Error ? e.message : "Invalid game events.",
      );
    }
    if (game === "reaction" && duration < 1500)
      throw new ApiError(400, "Run finished implausibly quickly.");
    if (game === "aim" && aimData.parse(raw).elapsedMs > duration + 1000)
      throw new ApiError(400, "Run timing exceeds session duration.");
    if (game === "memory" && memoryData.parse(raw).elapsedMs > duration + 1000)
      throw new ApiError(400, "Run timing exceeds session duration.");
    const name = rename
      ? normalizeName(rename)
      : {
          displayName: session.displayName,
          normalizedName: session.normalizedName,
        };
    const existing = await repo.entry(name.normalizedName);
    if (existing && existing.id !== session.data.returningEntryId)
      throw new ApiError(
        409,
        "Someone saved this tag during your run. Choose a different tag to save this result.",
        "NAME_COLLISION",
      );
    const personalBest = !existing || better(score, existing),
      now = new Date().toISOString();
    const entry: Entry = existing
      ? {
          ...existing,
          attemptCount: existing.attemptCount + 1,
          updatedAt: now,
          ...(personalBest
            ? {
                bestScore: score.score,
                bestTiebreakMs: score.tiebreakMs,
                bestAchievedAt: now,
              }
            : {}),
        }
      : {
          id: randomUUID(),
          gameId: game,
          rulesVersion: RULES_VERSION[game],
          ...name,
          bestScore: score.score,
          bestTiebreakMs: score.tiebreakMs,
          attemptCount: 1,
          bestAchievedAt: now,
          createdAt: now,
          updatedAt: now,
        };
    await repo.saveEntry(entry);
    await repo.saveAttempt({
      id: randomUUID(),
      sessionId: id,
      gameId: game,
      ...name,
      score: score.score,
      tiebreakMs: score.tiebreakMs,
      data: game === "trivia" ? session.data.answers : raw,
      createdAt: now,
    });
    const rank = ranked(await repo.board()).find(
      (e) => e.id === entry.id,
    )!.rank;
    const result: Result = {
      ...score,
      gameId: game,
      displayName: entry.displayName,
      best: entry.bestScore,
      rank,
      personalBest,
    };
    session.state = "finished";
    session.finishedAt = now;
    session.displayName = name.displayName;
    session.normalizedName = name.normalizedName;
    session.data.result = result;
    await repo.saveSession(session);
    return result;
  });
}
export async function abandonGame(game: GameId, id: string, token: string) {
  return transaction(game, async (repo) => {
    const session = await authorized(repo, id, token);
    if (session.state === "started") {
      session.state = "abandoned";
      await repo.saveSession(session);
    }
    return { ok: true };
  });
}
