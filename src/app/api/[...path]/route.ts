import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { createHash } from "node:crypto";
import { ACTIVE_GAME_IDS, GAME_IDS } from "@/lib/games";
import { nameSchema } from "@/lib/nickname";
import { ConfigurationError, environment } from "@/lib/env";
import { transaction, rateLimit } from "@/db/store";
import {
  abandonGame,
  answerQuestion,
  ApiError,
  finishGame,
  openQuestion,
  ranked,
  startGame,
} from "@/lib/competition";
import {
  checkAdmin,
  COOKIE,
  passwordMatches,
  signAdmin,
} from "@/lib/admin-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const gameSchema = z.enum(GAME_IDS);
const activeGameSchema = z.enum(ACTIVE_GAME_IDS);
const sessionSchema = z.object({
  gameId: activeGameSchema,
  sessionId: z.uuid(),
  token: z.string().regex(/^[a-f0-9]{64}$/),
});
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
function requireAdmin(req: NextRequest) {
  if (!checkAdmin(req.cookies.get(COOKIE)?.value))
    throw new ApiError(401, "Organizer login required.");
}
function csvCell(value: unknown) {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  try {
    const path = (await params).path.join("/");
    const env = environment();
    let body: unknown;
    if (req.method !== "GET") {
      const origin = req.headers.get("origin");
      // Next's internal URL may use 0.0.0.0. Compare the browser origin with
      // the public Host header instead; sibling sites still cannot submit.
      const originUrl = origin ? new URL(origin) : null;
      const protocol = process.env.VERCEL ? "https:" : req.nextUrl.protocol;
      if (
        !originUrl ||
        originUrl.host !== req.headers.get("host") ||
        originUrl.protocol !== protocol
      )
        throw new ApiError(403, "Request origin is not allowed.");
      if (Number(req.headers.get("content-length") || 0) > 20000)
        throw new ApiError(413, "Request too large.");
      const text = await req.text();
      if (text.length > 20000) throw new ApiError(413, "Request too large.");
      body = JSON.parse(text);
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0] || "local";
    // Shared-school Wi-Fi allowance; secrets and IP addresses are never returned.
    const key = createHash("sha256")
      .update(ip + ":" + path)
      .digest("hex");
    await rateLimit(key, path === "admin/login" ? 10 : 600, 60000);
    if (path === "health" && req.method === "GET") {
      if (!env.demo)
        await transaction("reaction", async (repo) => {
          await repo.board();
        });
      return json({
        ok: true,
        mode: env.demo ? "demo" : "live",
        database: env.demo ? "local-memory" : "neon",
      });
    }
    if (path === "leaderboard" && req.method === "GET") {
      const game = activeGameSchema.parse(
        req.nextUrl.searchParams.get("gameId"),
      );
      const rows = await transaction(game, async (repo) =>
        ranked(await repo.board()),
      );
      return json({
        entries: rows
          .slice(0, 10)
          .map(({ displayName, bestScore, bestTiebreakMs, rank }) => ({
            displayName,
            bestScore,
            bestTiebreakMs,
            rank,
          })),
        mode: env.demo ? "demo" : "live",
        total: rows.length,
      });
    }
    if (path === "nickname/check" && req.method === "POST") {
      const b = z
        .object({ gameId: activeGameSchema, name: nameSchema })
        .parse(body);
      const entry = await transaction(b.gameId, (repo) =>
        repo.entry(b.name.normalizedName),
      );
      return json({
        exists: !!entry,
        displayName: entry?.displayName || b.name.displayName,
      });
    }
    if (path === "game/start" && req.method === "POST") {
      const b = z
        .object({
          gameId: activeGameSchema,
          name: nameSchema,
          returning: z.boolean().default(false),
        })
        .parse(body);
      return json(await startGame(b.gameId, b.name.displayName, b.returning));
    }
    if (
      ["game/question", "game/answer", "game/finish", "game/abandon"].includes(
        path,
      ) &&
      req.method === "POST"
    ) {
      const value = body;
      const b = sessionSchema.parse(value);
      if (path === "game/question")
        return json(await openQuestion(b.gameId, b.sessionId, b.token));
      if (path === "game/abandon")
        return json(await abandonGame(b.gameId, b.sessionId, b.token));
      if (path === "game/answer") {
        const a = z
          .object({
            questionId: z.string().max(20),
            optionId: z.string().max(30).nullable(),
          })
          .parse(value);
        return json(
          await answerQuestion(
            b.gameId,
            b.sessionId,
            b.token,
            a.questionId,
            a.optionId,
          ),
        );
      }
      const a = z
        .object({ data: z.unknown(), rename: nameSchema.optional() })
        .parse(value);
      return json(
        await finishGame(
          b.gameId,
          b.sessionId,
          b.token,
          a.data,
          a.rename?.displayName,
        ),
      );
    }
    if (path === "admin/login" && req.method === "POST") {
      const { password } = z
        .object({ password: z.string().max(512) })
        .parse(body);
      if (!passwordMatches(password))
        throw new ApiError(401, "Incorrect password.");
      const response = json({ ok: true });
      response.cookies.set(COOKIE, signAdmin(), {
        httpOnly: true,
        secure: !env.demo,
        sameSite: "strict",
        path: "/",
        maxAge: 28800,
      });
      return response;
    }
    if (path === "admin/logout" && req.method === "POST") {
      const response = json({ ok: true });
      response.cookies.delete(COOKIE);
      return response;
    }
    if (path.startsWith("admin/")) {
      requireAdmin(req);
      if (path === "admin/board" && req.method === "GET") {
        const game = gameSchema.parse(req.nextUrl.searchParams.get("gameId"));
        return json({
          entries: await transaction(game, async (repo) =>
            ranked(await repo.board()),
          ),
          mode: env.demo ? "demo" : "live",
        });
      }
      if (path === "admin/export" && req.method === "GET") {
        const game = gameSchema.parse(req.nextUrl.searchParams.get("gameId"));
        const rows = await transaction(game, async (repo) =>
          ranked(await repo.board()),
        );
        const csv =
          "game,player,best score,rank,attempts,achieved at\r\n" +
          rows
            .map((e) =>
              [
                game,
                e.displayName,
                e.bestScore,
                e.rank,
                e.attemptCount,
                e.bestAchievedAt,
              ]
                .map(csvCell)
                .join(","),
            )
            .join("\r\n");
        return new NextResponse(csv, {
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="n7geeks-${game}.csv"`,
            "Cache-Control": "no-store",
          },
        });
      }
      if (path === "admin/reset" && req.method === "POST") {
        const b = z
          .object({ gameId: gameSchema, confirmation: z.string() })
          .parse(body);
        if (b.confirmation !== `RESET ${b.gameId.toUpperCase()}`)
          throw new ApiError(400, "Type the exact reset phrase.");
        await transaction(b.gameId, (repo) => repo.remove());
        return json({ ok: true });
      }
      if (path === "admin/delete" && req.method === "POST") {
        const b = z
          .object({
            gameId: gameSchema,
            name: nameSchema,
            confirmation: z.literal("DELETE"),
          })
          .parse(body);
        await transaction(b.gameId, (repo) =>
          repo.remove(b.name.normalizedName),
        );
        return json({ ok: true });
      }
    }
    throw new ApiError(404, "Endpoint not found.");
  } catch (e) {
    if (e instanceof ApiError)
      return json({ error: e.message, code: e.code }, e.status);
    if (e instanceof ConfigurationError)
      return json({ error: e.message, code: "CONFIGURATION_REQUIRED" }, 503);
    if (e instanceof ZodError)
      return json({ error: e.issues[0]?.message || "Invalid input." }, 400);
    if (e instanceof SyntaxError) return json({ error: "Invalid JSON." }, 400);
    if ((e as Error).message === "RATE_LIMIT")
      return json(
        { error: "Too many requests. Wait a minute and retry." },
        429,
      );
    console.error(
      "Arcade request failed:",
      e instanceof Error ? e.message : "unknown error",
    );
    return json(
      {
        error:
          "Arcade service unavailable. Check database setup or retry shortly.",
      },
      503,
    );
  }
}
export { handler as GET, handler as POST };
