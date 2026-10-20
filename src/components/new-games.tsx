"use client";
import { useEffect, useRef, useState } from "react";
import type { GameSession } from "@/lib/games";
import { COLORS, INKS } from "@/lib/new-challenges";
import { beep } from "./games";

export function NewGame({
  session,
  onFinish,
  muted,
}: {
  session: GameSession;
  onFinish: (data: unknown) => void;
  muted: boolean;
}) {
  const challenges = session.challenges!;
  const rhythm = session.gameId === "rhythm";
  const [running, setRunning] = useState(false),
    [now, setNow] = useState(0),
    [round, setRound] = useState(0),
    [feedback, setFeedback] = useState(""),
    [hits, setHits] = useState<number[]>([]);
  const state = useRef({
    start: 0,
    round: 0,
    roundStart: 0,
    done: false,
    events: [] as { choice: number | null; at: number }[],
    hits: new Set<number>(),
  });
  const callbacks = useRef({ onFinish, muted });
  callbacks.current = { onFinish, muted };
  const act = useRef<(choice: number | null) => void>(() => {});
  act.current = (choice) => {
    const s = state.current;
    if (!s.start || s.done) return;
    const at = Math.round(performance.now() - s.start);
    if (rhythm) {
      if (choice === null || s.events.length >= 300) return;
      s.events.push({ choice, at });
      const index = challenges.findIndex(
        (n, i) =>
          !s.hits.has(i) &&
          n.lane === choice &&
          Math.abs(at - n.at) <= n.limitMs,
      );
      if (index >= 0) {
        s.hits.add(index);
        setHits([...s.hits]);
        setFeedback(
          Math.abs(at - challenges[index].at) < challenges[index].limitMs * 0.3
            ? "PERFECT"
            : "HIT",
        );
        beep(callbacks.current.muted, 400 + choice * 150);
      } else setFeedback("OFF BEAT");
      return;
    }
    if (at - s.roundStart < 80) return;
    const c = challenges[s.round];
    if (at - s.roundStart >= c.limitMs) choice = null;
    s.events.push({ choice, at });
    s.round++;
    s.roundStart = at;
    if (choice !== null) beep(callbacks.current.muted, 650);
    if (s.round === challenges.length) {
      s.done = true;
      callbacks.current.onFinish({ events: s.events, elapsedMs: at });
    } else setRound(s.round);
  };
  useEffect(() => {
    if (!running) return;
    let frame: number;
    const tick = () => {
      const s = state.current;
      if (s.done) return;
      const at = Math.round(performance.now() - s.start);
      setNow(at);
      if (rhythm && at >= challenges.at(-1)!.at + 350) {
        s.done = true;
        callbacks.current.onFinish({ events: s.events, elapsedMs: at });
        return;
      }
      if (!rhythm && at - s.roundStart >= challenges[s.round].limitMs)
        act.current(null);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const key = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      const lane = "1234".indexOf(e.key);
      const index =
        lane >= 0 ? lane : rhythm ? "dfjk".indexOf(e.key.toLowerCase()) : -1;
      if (
        index >= 0 &&
        !(e.target instanceof Element && e.target.closest("dialog"))
      ) {
        e.preventDefault();
        act.current(index);
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", key);
    };
  }, [running, challenges, rhythm]);
  if (!running)
    return (
      <div className="new-ready">
        <span className="eyebrow">FRESH PATTERNS / RISING DIFFICULTY</span>
        <h2>
          {rhythm
            ? "FIND YOUR FLOW."
            : session.gameId === "color"
              ? "TRUST YOUR EYES."
              : "THINK FAST."}
        </h2>
        <p>
          {rhythm
            ? "Follow the falling notes. Hit D F J K when they cross the blue line. Headphones optional."
            : "Choose with keys 1–4 or tap. Every round gets harder. Accuracy comes first."}
        </p>
        <button
          className="button blue"
          onClick={() => {
            state.current.start = performance.now();
            setRunning(true);
          }}
        >
          START {rhythm ? "TRACK" : "CHALLENGE"} ↗
        </button>
      </div>
    );
  const c = challenges[round];
  const remaining = rhythm
    ? Math.max(0, challenges.at(-1)!.at + 350 - now)
    : Math.max(0, c.limitMs - (now - state.current.roundStart));
  return (
    <div className="new-game">
      <div className="new-stats">
        <span>
          {rhythm ? `${hits.length} / 60 HITS` : `ROUND ${round + 1} / 20`}
        </span>
        <b>{(remaining / 1000).toFixed(1)}s</b>
        <span>
          LEVEL{" "}
          {rhythm
            ? Math.min(6, 1 + Math.floor(now / 6500))
            : 1 + Math.floor(round / 4)}
        </span>
      </div>
      {rhythm ? (
        <>
          <div
            className="rhythm-track"
            aria-label="Falling notes; hit at the blue line"
          >
            {[0, 1, 2, 3].map((lane) => (
              <div className="rhythm-lane" key={lane}>
                {challenges.map((note, i) =>
                  note.lane === lane &&
                  !hits.includes(i) &&
                  note.at - now < 1800 &&
                  note.at - now > -250 ? (
                    <i
                      key={i}
                      className="rhythm-note"
                      style={{ top: `${80 - ((note.at - now) / 1800) * 80}%` }}
                    />
                  ) : null,
                )}
              </div>
            ))}
            <div className="rhythm-line" />
          </div>
          <div className="lane-buttons">
            {["D / 1", "F / 2", "J / 3", "K / 4"].map((key, i) => (
              <button
                key={key}
                onPointerDown={(e) => {
                  e.preventDefault();
                  act.current(i);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    act.current(i);
                  }
                }}
                aria-label={`Hit lane ${i + 1}`}
              >
                {key}
              </button>
            ))}
          </div>
          <p className="rhythm-feedback" aria-live="off">
            {feedback || "WATCH THE BLUE LINE"}
          </p>
        </>
      ) : (
        <>
          <div
            className="round-timer"
            role="progressbar"
            aria-label="Time remaining"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((remaining / c.limitMs) * 100)}
          >
            <i style={{ width: `${(remaining / c.limitMs) * 100}%` }} />
          </div>
          <p className="eyebrow">
            {session.gameId === "color"
              ? "CHOOSE THE INK COLOR"
              : "CHOOSE THE ANSWER"}
          </p>
          <h2
            className="challenge-prompt"
            style={session.gameId === "color" ? { color: INKS[c.ink] } : {}}
          >
            {c.prompt}
          </h2>
          <div className="challenge-options">
            {c.options.map((option, i) => (
              <button
                key={i}
                onClick={() => act.current(i)}
                aria-label={`Option ${i + 1}: ${option}`}
              >
                <small>{i + 1}</small>
                {session.gameId === "color" ? COLORS[i] : option}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
