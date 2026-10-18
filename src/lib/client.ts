import type { GameSession } from "./games";
export class RequestError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
  }
}
export async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const value = await response.json();
  if (!response.ok)
    throw new RequestError(
      value.error || "Request failed. Try again.",
      value.code,
      response.status,
    );
  return value;
}
export const credentials = (session: GameSession) => ({
  gameId: session.gameId,
  sessionId: session.id,
  token: session.token,
});
