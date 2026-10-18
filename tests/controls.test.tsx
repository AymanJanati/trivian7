// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Reaction, Memory, Aim, Trivia } from "@/components/games";
import type { GameSession } from "@/lib/games";
import { aimScore, memoryScore, reactionScore } from "@/lib/scoring";
import { request } from "@/lib/client";
vi.mock("@/lib/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/client")>()),
  request: vi.fn(),
}));
import {
  MEMORY_ROUNDS,
  MEMORY_TRANSITION_MS,
  memoryPlaybackMs,
} from "@/lib/rules";
const session: GameSession = {
  id: "id",
  token: "token",
  gameId: "memory",
  displayName: "Nova",
  sequences: MEMORY_ROUNDS.map((r, round) =>
    Array.from({ length: r.length }, (_, i) => (i + round) % 9),
  ),
};
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "performance",
    ],
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
describe("actual gameplay controls", () => {
  it("supports five reaction keyboard trials with high-resolution timings", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const done = vi.fn();
    render(
      <Reaction
        session={{ ...session, gameId: "reaction" }}
        onFinish={done}
        muted
      />,
    );
    fireEvent.keyDown(window, { code: "Space" });
    for (let i = 0; i < 5; i++) {
      advance(1700);
      fireEvent.keyDown(window, { code: "Space" });
      advance(700);
    }
    expect(done).toHaveBeenCalledTimes(1);
    expect(reactionScore(done.mock.calls[0][0]).score).toBe(900);
  });
  it("consumes early reaction taps and rejects double inputs during feedback", () => {
    const done = vi.fn();
    render(
      <Reaction
        session={{ ...session, gameId: "reaction" }}
        onFinish={done}
        muted
      />,
    );
    fireEvent.keyDown(window, { code: "Space" });
    for (let i = 0; i < 5; i++) {
      fireEvent.keyDown(window, { code: "Space" });
      fireEvent.keyDown(window, { code: "Space" });
      advance(700);
    }
    expect(done).toHaveBeenCalledTimes(1);
    expect(done.mock.calls[0][0]).toEqual({ trials: [-1, -1, -1, -1, -1] });
  });
  it("plays all ten fresh memory rounds, blocks playback input and agrees with server scoring", () => {
    const done = vi.fn();
    render(<Memory session={session} onFinish={done} muted />);
    fireEvent.click(screen.getByRole("button", { name: /START SEQUENCE/ }));
    fireEvent.keyDown(window, { key: "9" });
    for (let r = 0; r < MEMORY_ROUNDS.length; r++) {
      advance(memoryPlaybackMs(r));
      for (let i = 0; i < MEMORY_ROUNDS[r].length; i++) {
        advance(90);
        fireEvent.keyDown(window, {
          key: String(session.sequences![r][i] + 1),
        });
      }
      if (r < MEMORY_ROUNDS.length - 1) advance(MEMORY_TRANSITION_MS);
    }
    expect(done).toHaveBeenCalledTimes(1);
    expect(memoryScore(done.mock.calls[0][0], session.sequences!).score).toBe(
      1000,
    );
  });
  it("continues memory playback when the sound preference changes", () => {
    const done = vi.fn();
    const view = render(<Memory session={session} onFinish={done} muted />);
    fireEvent.click(screen.getByRole("button", { name: /START SEQUENCE/ }));
    advance(900);
    view.rerender(<Memory session={session} onFinish={done} muted={false} />);
    advance(memoryPlaybackMs(0) - 900 + 100);
    fireEvent.keyDown(window, { key: "9" });
    expect(done).toHaveBeenCalledTimes(1);
  });
  it("ends memory when the round's input window expires", () => {
    const done = vi.fn();
    render(<Memory session={session} onFinish={done} muted />);
    fireEvent.click(screen.getByRole("button", { name: /START SEQUENCE/ }));
    advance(memoryPlaybackMs(0) + MEMORY_ROUNDS[0].inputMs + 100);
    fireEvent.keyDown(window, { key: String(session.sequences![0][0] + 1) });
    expect(done).toHaveBeenCalledTimes(1);
    expect(memoryScore(done.mock.calls[0][0], session.sequences!).score).toBe(
      0,
    );
  });
  it("ends aim at thirty seconds and ignores later pointer hits", () => {
    const done = vi.fn();
    render(
      <Aim session={{ ...session, gameId: "aim" }} onFinish={done} muted />,
    );
    fireEvent.click(screen.getByRole("button", { name: /START TARGETS/ }));
    advance(200);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Target 1" }));
    advance(30000);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Target 2" }));
    expect(done).toHaveBeenCalledTimes(1);
    expect(aimScore(done.mock.calls[0][0]).score).toBe(40);
  });
  it("submits a quiz timeout with no fabricated choice and exposes retry on failure", async () => {
    const mocked = vi.mocked(request);
    mocked
      .mockResolvedValueOnce({
        id: "L01",
        category: "linux",
        difficulty: "easy",
        prompt: "Question?",
        options: [0, 1, 2, 3].map((i) => ({
          id: String(i),
          text: `Option ${i}`,
        })),
        timeLimitMs: 10000,
        remainingMs: 10000,
        openedAt: 0,
        deadline: 10000,
        index: 0,
      })
      .mockRejectedValueOnce(new Error("Network unavailable"));
    render(
      <Trivia
        session={{ ...session, gameId: "trivia" }}
        onFinish={vi.fn()}
        muted
      />,
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: /START QUIZ/ })),
    );
    await act(async () => vi.advanceTimersByTime(10100));
    expect(mocked).toHaveBeenLastCalledWith(
      "game/answer",
      expect.objectContaining({ questionId: "L01", optionId: null }),
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Network unavailable",
    );
    expect(screen.getByRole("button", { name: "RETRY" })).toBeTruthy();
  });
});
