"use client";
import { ui, dynamicCopy } from "@/lib/ui-copy";
import { useCallback, useEffect, useRef, useState } from "react";
import { Crosshair, Zap } from "lucide-react";
import type { GameSession, PublicQuestion } from "@/lib/games";
import { credentials, request } from "@/lib/client";
import {
  MEMORY_LEAD_MS,
  MEMORY_LIMIT_MS,
  MEMORY_ROUNDS,
  MEMORY_TRANSITION_MS,
  memoryPlaybackMs,
} from "@/lib/rules";
type Props = {
  session: GameSession;
  onFinish: (data: unknown) => void;
  muted: boolean;
};
export function beep(muted: boolean, frequency = 600) {
  if (muted) return;
  try {
    const ctx = new AudioContext(),
      osc = ctx.createOscillator(),
      gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.045, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
    osc.onended = () => void ctx.close();
  } catch {}
}
export function Reaction({ onFinish, muted }: Props) {
  const [phase, setPhase] = useState<"ready" | "wait" | "cue" | "feedback">(
    "ready",
  );
  const [message, setMessage] = useState<string>(
    ui.yourReflexesHaveBeenSummoned,
  );
  const [trial, setTrial] = useState(1);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]),
    trials = useRef<number[]>([]),
    cueAt = useRef(0),
    current = useRef(phase);
  const change = useCallback((p: typeof phase) => {
    current.current = p;
    setPhase(p);
  }, []);
  const settleRef = useRef<(value: number, label: string) => void>(() => {});
  const next = useCallback(() => {
    change("wait");
    setTrial(trials.current.length + 1);
    setMessage(ui.waitForBlue);
    timers.current.push(
      setTimeout(
        () => {
          cueAt.current = performance.now();
          change("cue");
          setMessage(ui.now);
          timers.current.push(
            setTimeout(() => {
              if (current.current === "cue") {
                current.current = "feedback";
                settleRef.current(-1, ui.timeOut);
              }
            }, 1500),
          );
        },
        1500 + Math.random() * 2500,
      ),
    );
  }, [change]);
  settleRef.current = (value, label) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    trials.current.push(value);
    change("feedback");
    setMessage(label);
    beep(muted, value >= 100 ? 800 : 200);
    timers.current.push(
      setTimeout(() => {
        if (trials.current.length === 5) onFinish({ trials: trials.current });
        else next();
      }, 700),
    );
  };
  const tap = useCallback(() => {
    if (current.current === "ready") {
      next();
      return;
    }
    if (current.current === "feedback") return;
    if (current.current === "wait") settleRef.current(-1, ui.tooEarly);
    else {
      const ms = Math.round(performance.now() - cueAt.current);
      settleRef.current(
        ms > 1500 ? -1 : ms,
        ms > 1500
          ? ui.timeOut
          : ms < 100
            ? ui.tooFastToCount
            : dynamicCopy.reactionMs(ms),
      );
    }
  }, [next]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        ["Space", "Enter"].includes(e.code) &&
        !e.repeat &&
        !(e.target instanceof HTMLButtonElement)
      ) {
        e.preventDefault();
        tap();
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      timers.current.forEach(clearTimeout);
    };
  }, [tap]);
  return (
    <>
      <div className="game-metrics">
        <span>
          {ui.trial}
          <b>{String(trial).padStart(2, "0")} / 05</b>
        </span>
        <span>{ui.falseStart0Points}</span>
      </div>
      <button
        className={`reaction-field ${phase}`}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          e.preventDefault();
          tap();
        }}
        onKeyDown={(e) => {
          if ([" ", "Enter"].includes(e.key) && !e.repeat) {
            e.preventDefault();
            tap();
          }
        }}
        aria-label={phase === "ready" ? ui.startReactionTest : message}
      >
        <Zap size={64} />
        <strong>{phase === "ready" ? ui.ready : message}</strong>
        <span>
          {phase === "ready"
            ? ui.tapOrPressSpaceToBegin
            : phase === "cue"
              ? ui.tapSpaceEnter
              : phase === "feedback"
                ? ui.nextTrialLoading
                : ui.holdYourNerve}
        </span>
      </button>
      <div className="trial-dots">
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} className={i < trials.current.length ? "done" : ""} />
        ))}
      </div>
    </>
  );
}
export function Memory({ session, onFinish, muted }: Props) {
  const [started, setStarted] = useState(false),
    [round, setRound] = useState(0),
    [flash, setFlash] = useState<number | null>(null),
    [phase, setPhase] = useState<string>(ui.watchThePattern),
    [inputIndex, setInputIndex] = useState(0),
    [remaining, setRemaining] = useState(0);
  const sequences = session.sequences!,
    timers = useRef<ReturnType<typeof setTimeout>[]>([]),
    startAt = useRef(0),
    inputs = useRef<{ tile: number; at: number }[]>([]),
    roundRef = useRef(0),
    index = useRef(0),
    accepting = useRef(false),
    finished = useRef(false),
    inputDeadline = useRef(0);
  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    accepting.current = false;
    timers.current.forEach(clearTimeout);
    onFinish({
      inputs: inputs.current,
      elapsedMs: Math.min(
        MEMORY_LIMIT_MS,
        Math.round(performance.now() - startAt.current),
      ),
    });
  }, [onFinish]);
  const play = useCallback(
    (r: number) => {
      accepting.current = false;
      roundRef.current = r;
      index.current = 0;
      setRound(r);
      setInputIndex(0);
      setPhase(ui.watchThePattern);
      const config = MEMORY_ROUNDS[r];
      inputDeadline.current =
        performance.now() + memoryPlaybackMs(r) + config.inputMs;
      for (let i = 0; i < config.length; i++) {
        timers.current.push(
          setTimeout(
            () => {
              setFlash(sequences[r][i]);
              beep(muted, 400 + sequences[r][i] * 65);
            },
            MEMORY_LEAD_MS + i * (config.flashMs + config.gapMs),
          ),
        );
        timers.current.push(
          setTimeout(
            () => setFlash(null),
            MEMORY_LEAD_MS +
              i * (config.flashMs + config.gapMs) +
              config.flashMs,
          ),
        );
      }
      timers.current.push(
        setTimeout(() => {
          accepting.current = true;
          setPhase(ui.yourTurn);
        }, memoryPlaybackMs(r)),
      );
    },
    [muted, sequences],
  );
  const tap = useCallback(
    (tile: number) => {
      if (!accepting.current || finished.current) return;
      const at = Math.round(performance.now() - startAt.current);
      if (at >= MEMORY_LIMIT_MS || performance.now() >= inputDeadline.current) {
        finish();
        return;
      }
      inputs.current.push({ tile, at });
      setFlash(tile);
      timers.current.push(setTimeout(() => setFlash(null), 150));
      if (tile !== sequences[roundRef.current][index.current]) {
        beep(muted, 160);
        setPhase(ui.bufferLost);
        finish();
        return;
      }
      beep(muted, 400 + tile * 65);
      index.current++;
      setInputIndex(index.current);
      if (index.current === MEMORY_ROUNDS[roundRef.current].length) {
        accepting.current = false;
        inputDeadline.current = 0;
        setPhase(ui.synced);
        if (roundRef.current === MEMORY_ROUNDS.length - 1) {
          finish();
          return;
        }
        timers.current.push(
          setTimeout(() => play(roundRef.current + 1), MEMORY_TRANSITION_MS),
        );
      }
    },
    [finish, muted, play, sequences],
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (/^[1-9]$/.test(e.key) && !e.repeat) {
        e.preventDefault();
        tap(Number(e.key) - 1);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [tap]);
  useEffect(() => {
    const scheduled = timers.current;
    return () => scheduled.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    if (!started) return;
    const interval = setInterval(() => {
      if (finished.current) return;
      const left = Math.max(0, inputDeadline.current - performance.now());
      setRemaining(left);
      if (accepting.current && left === 0) finish();
    }, 50);
    return () => clearInterval(interval);
  }, [started, finish]);
  const begin = () => {
    setStarted(true);
    startAt.current = performance.now();
    timers.current.push(setTimeout(finish, MEMORY_LIMIT_MS));
    play(0);
  };
  return (
    <>
      <div className="game-metrics">
        <span>
          {ui.round}
          <b>
            {String(round + 1).padStart(2, "0")} / {MEMORY_ROUNDS.length}
          </b>
        </span>
        <span>
          <span>{started ? phase : ui.memoryBufferReady}</span>
          {started && phase === ui.yourTurn && (
            <b>{(remaining / 1000).toFixed(1)}s</b>
          )}
        </span>
      </div>
      {!started ? (
        <div className="game-ready">
          <div className="large-symbol">▦</div>
          <h2>{ui.rememberRepeat}</h2>
          <p>{ui.thePatternGrowsCanYouKeepUp}</p>
          <button className="button blue" onClick={begin}>
            {ui.startSequence}
          </button>
        </div>
      ) : (
        <>
          <div className="memory-grid">
            {Array.from({ length: 9 }, (_, i) => (
              <button
                key={i}
                aria-label={dynamicCopy.tile(i + 1)}
                aria-disabled={phase !== ui.yourTurn}
                className={`memory-tile ${flash === i ? "lit" : ""}`}
                onPointerDown={(e) => {
                  e.preventDefault();
                  tap(i);
                }}
                onKeyDown={(e) => {
                  if (["Enter", " "].includes(e.key) && !e.repeat) {
                    e.preventDefault();
                    tap(i);
                  }
                }}
              >
                <span>{["◇", "＋", "○", "△", "□", "×", "⬡", "≋", "✳"][i]}</span>
                <small>{i + 1}</small>
              </button>
            ))}
          </div>
          <p className="game-hint">
            {phase}{" "}
            <span>
              {inputIndex} / {MEMORY_ROUNDS[round].length}
            </span>
          </p>
        </>
      )}
    </>
  );
}
export function Aim({ onFinish, muted }: Props) {
  const [started, setStarted] = useState(false),
    [remaining, setRemaining] = useState(30000),
    [hits, setHits] = useState(0),
    [position, setPosition] = useState({ x: 50, y: 50 });
  const startAt = useRef(0),
    events = useRef<number[]>([]),
    misses = useRef(0),
    finished = useRef(false),
    lastHit = useRef(-1000);
  const finish = useCallback(
    (elapsedMs: number) => {
      if (finished.current) return;
      finished.current = true;
      onFinish({ hits: events.current, misses: misses.current, elapsedMs });
    },
    [onFinish],
  );
  useEffect(() => {
    if (!started) return;
    const timer = setInterval(() => {
      const elapsed = performance.now() - startAt.current;
      setRemaining(Math.max(0, 30000 - elapsed));
      if (elapsed >= 30000) finish(30000);
    }, 33);
    return () => clearInterval(timer);
  }, [started, finish]);
  const hit = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (finished.current) return;
    const elapsed = Math.round(performance.now() - startAt.current);
    if (elapsed >= 30000) {
      finish(30000);
      return;
    }
    if (elapsed - lastHit.current < 50) return;
    lastHit.current = elapsed;
    events.current.push(elapsed);
    setHits(events.current.length);
    beep(muted, 950);
    if (events.current.length === 20) {
      finish(elapsed);
      return;
    }
    let point = { x: Math.random() * 100, y: Math.random() * 100 };
    for (
      let i = 0;
      i < 30 && Math.hypot(point.x - position.x, point.y - position.y) < 32;
      i++
    )
      point = { x: Math.random() * 100, y: Math.random() * 100 };
    setPosition(point);
  };
  return (
    <>
      <div className="game-metrics">
        <span>
          {ui.targets}
          <b>{String(hits).padStart(2, "0")} / 20</b>
        </span>
        <span className={remaining < 5000 ? "danger-text" : ""}>
          {ui.time}
          <b>
            {(remaining / 1000).toFixed(1)}
            {ui.s}
          </b>
        </span>
      </div>
      <div
        className="aim-field"
        onPointerDown={() => {
          if (
            started &&
            !finished.current &&
            performance.now() - startAt.current < 30000
          )
            misses.current++;
        }}
      >
        {!started ? (
          <div className="game-ready">
            <Crosshair size={80} />
            <h2>{ui.lockInHit20}</h2>
            <p>{ui.precisionIsGoodFastPrecisionIsBetter}</p>
            <button
              className="button blue"
              onClick={() => {
                startAt.current = performance.now();
                setStarted(true);
              }}
            >
              {ui.startTargets}
            </button>
          </div>
        ) : (
          <div className="target-bounds">
            <button
              aria-label={dynamicCopy.target(hits + 1)}
              className="aim-target"
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              onPointerDown={hit}
            >
              <span />
              <i />
            </button>
          </div>
        )}
      </div>
    </>
  );
}
export function Trivia({ session, onFinish, muted }: Props) {
  const [question, setQuestion] = useState<PublicQuestion | null>(null),
    [remaining, setRemaining] = useState(10000),
    [feedback, setFeedback] = useState<{
      correct: boolean;
      correctOptionId: string;
      explanation: string;
    } | null>(null),
    [chosen, setChosen] = useState<string | null>(null),
    [error, setError] = useState(""),
    [started, setStarted] = useState(false),
    [loading, setLoading] = useState(false);
  const locked = useRef(false),
    deadline = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    alive = useRef(true),
    pending = useRef<{ id: string; option: string | null } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = await request<PublicQuestion | { complete: true }>(
        "game/question",
        credentials(session),
      );
      if (!alive.current) return;
      if ("complete" in q) {
        onFinish({});
        return;
      }
      // Server-reported remaining duration avoids dependence on the device clock.
      // A small grace on the client request ensures timeout is never submitted early.
      deadline.current = performance.now() + q.remainingMs + 30;
      setQuestion(q);
      setRemaining(Math.min(q.timeLimitMs, q.remainingMs));
      setFeedback(null);
      setChosen(null);
      locked.current = false;
    } catch (e) {
      if (alive.current) setError((e as Error).message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [session, onFinish]);
  const answer = useCallback(
    async (option: string | null) => {
      if (!question || locked.current) return;
      locked.current = true;
      pending.current = { id: question.id, option };
      setChosen(option);
      setError("");
      try {
        const result = await request<{
          correct: boolean;
          correctOptionId: string;
          explanation: string;
        }>("game/answer", {
          ...credentials(session),
          questionId: question.id,
          optionId: option,
        });
        if (!alive.current) return;
        pending.current = null;
        setFeedback(result);
        beep(muted, result.correct ? 850 : 200);
        timer.current = setTimeout(() => void load(), 1100);
      } catch (e) {
        if (alive.current) setError((e as Error).message);
      }
    },
    [question, session, load, muted],
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    if (!question || feedback) return;
    const interval = setInterval(() => {
      const left = Math.max(0, deadline.current - performance.now());
      setRemaining(left);
      if (left === 0 && !locked.current) void answer(null);
    }, 40);
    return () => clearInterval(interval);
  }, [question, feedback, answer]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (/^[1-4]$/.test(e.key) && !e.repeat && question && !feedback) {
        e.preventDefault();
        void answer(question.options[Number(e.key) - 1].id);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [question, feedback, answer]);
  const retry = () => {
    if (pending.current) {
      const option = pending.current.option;
      locked.current = false;
      void answer(option);
    } else void load();
  };
  if (!started)
    return (
      <div className="game-ready">
        <div className="large-symbol">{"{ ? }"}</div>
        <h2>{ui.nerdCheck}</h2>
        <p>{ui.fiveTopicsFiveQuestionsTenSecondsEach}</p>
        <button
          className="button blue"
          onClick={() => {
            setStarted(true);
            void load();
          }}
        >
          {ui.startQuiz}
        </button>
      </div>
    );
  return (
    <>
      {question && (
        <>
          <div className="game-metrics">
            <span>
              {ui.question}
              <b>
                {String(question.index + 1).padStart(2, "0")} / {question.total}
              </b>
            </span>
            <span>
              {(remaining / 1000).toFixed(1)}
              {ui.s}
            </span>
          </div>
          <div className="time-track">
            <i
              style={{
                width: `${Math.min(100, (remaining / question.timeLimitMs) * 100)}%`,
              }}
            />
          </div>
          <div className="question">
            <span className="eyebrow">
              {question.category} / {question.difficulty} ·{" "}
              {dynamicCopy.questionPoints(question.maxPoints)}
            </span>
            <h2>{question.prompt}</h2>
            <div className="answers">
              {question.options.map((o, i) => (
                <button
                  key={o.id}
                  disabled={locked.current || loading}
                  className={`${feedback?.correctOptionId === o.id ? "correct" : ""} ${feedback && chosen === o.id && !feedback.correct ? "incorrect" : ""}`}
                  onClick={() => void answer(o.id)}
                >
                  <span>0{i + 1}</span>
                  {o.text}
                </button>
              ))}
            </div>
            <div aria-live="polite" className="quiz-feedback">
              {feedback && (
                <>
                  <b>{feedback.correct ? ui.correct : ui.nope}</b>{" "}
                  {feedback.explanation}
                </>
              )}
            </div>
          </div>
        </>
      )}
      {loading && !question && (
        <div className="game-ready">{ui.loadingQuestion}</div>
      )}
      {error && (
        <div className="error-box" role="alert">
          {error}
          <button className="button" onClick={retry}>
            {ui.retry}
          </button>
        </div>
      )}
    </>
  );
}
