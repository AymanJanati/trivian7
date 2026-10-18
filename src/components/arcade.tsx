"use client";
import { ui, dynamicCopy } from "@/lib/ui-copy";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  ChevronRight,
  Crosshair,
  Loader2,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";
import {
  games,
  GAME_IDS,
  copy,
  type Entry,
  type GameId,
  type GameSession,
  type Result,
} from "@/lib/games";
import { credentials, request, RequestError } from "@/lib/client";
import { normalizeName } from "@/lib/nickname";
import { Reaction, Memory, Aim, Trivia } from "./games";
type Pending = { session: GameSession; data: unknown };
const PENDING = "n7arcade:pending";
function Preview({ game }: { game: GameId }) {
  if (game === "reaction")
    return (
      <div className="card-preview reaction-preview">
        <div className="cross-mark">+</div>
        <svg viewBox="0 0 300 84" aria-hidden="true">
          <path d="M0 48h60l10-12 12 24 15-48 20 64 16-28h28l12-8 15 16 15-8h97" />
        </svg>
        <div className="preview-readout">
          <b>187</b>
          <small>{ui.ms}</small>
        </div>
      </div>
    );
  if (game === "memory")
    return (
      <div className="card-preview memory-preview">
        <div className="mini-tiles">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} className={[0, 4, 7].includes(i) ? "on" : ""} />
          ))}
        </div>
        <span className="preview-side">
          {ui.watch}
          <br />
          {ui.repeat}
          <br />
          <b>{ui.level06}</b>
        </span>
      </div>
    );
  if (game === "aim")
    return (
      <div className="card-preview aim-preview">
        <Crosshair size={97} strokeWidth={1} />
        <div className="aim-coordinate">
          {ui.x072}
          <br />
          {ui.y019}
          <br />
          <b>{ui.targetLocked}</b>
        </div>
        <span className="tiny-target">+</span>
      </div>
    );
  return (
    <div className="card-preview trivia-preview">
      <b className="code-art">{"{ ? }"}</b>
      <div className="quiz-sticker">
        {ui.certified}
        <br />
        <b>{ui.geek}</b>
      </div>
    </div>
  );
}
function TagDialog({
  game,
  onClose,
  onStart,
}: {
  game: GameId;
  onClose: () => void;
  onStart: (session: GameSession) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(""),
    [exists, setExists] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    input.current?.focus();
    return () => node?.close();
  }, []);
  const submit = async (returning = false) => {
    setError("");
    try {
      normalizeName(name);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setBusy(true);
    try {
      if (!returning) {
        const check = await request<{ exists: boolean; displayName: string }>(
          "nickname/check",
          { gameId: game, name },
        );
        if (check.exists) {
          setExists(true);
          setBusy(false);
          return;
        }
      }
      onStart(
        await request<GameSession>("game/start", {
          gameId: game,
          name,
          returning,
        }),
      );
    } catch (e) {
      if (e instanceof RequestError && e.code === "TAG_EXISTS") setExists(true);
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      className="tag-dialog"
      aria-labelledby="tag-title"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="dialog-inner">
        <button
          className="icon-button dialog-close"
          aria-label={ui.closeTagEntry}
          onClick={onClose}
        >
          <X />
        </button>
        <span className="eyebrow">
          {ui.playerEntry}
          {games[game].number}
        </span>
        <h2 id="tag-title">
          {exists ? copy.existingTitle : copy.tagTitle}
          <span className="blue-text">_</span>
        </h2>
        {exists ? (
          <>
            <p>
              “{name}
              {ui.alreadyHasAScoreIn}
              {games[game].name}
              {ui.isThatYou}
            </p>
            <p className="fine-print">
              {ui.friendlyCompetitionThisChoiceIsBasedOnTrust}
            </p>
            <button
              className="button blue full"
              disabled={busy}
              onClick={() => void submit(true)}
            >
              {busy ? <Loader2 className="spin" /> : copy.yes}{" "}
              <ArrowUpRight size={18} />
            </button>
            <button
              className="text-button full"
              disabled={busy}
              onClick={() => {
                setExists(false);
                setTimeout(() => input.current?.focus(), 0);
              }}
            >
              {copy.no}
            </button>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <p>
              {ui.thisNameWillAppearOnThe}
              {games[game].name} {ui.leaderboard}
            </p>
            <label className="field-label" htmlFor="nickname">
              {ui.yourNickname}
            </label>
            <input
              ref={input}
              id="nickname"
              autoComplete="off"
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={ui.eGNova}
              dir="auto"
              required
            />
            <span className="fine-print">
              {ui.label216CharactersMakeItYours}
            </span>
            <button className="button blue full" disabled={busy} type="submit">
              {busy ? <Loader2 className="spin" /> : ui.letSPlay}
              <ArrowUpRight size={18} />
            </button>
          </form>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
}
export default function Arcade({
  initialGame = "reaction",
  autoPlay = false,
}: {
  initialGame?: GameId;
  autoPlay?: boolean;
}) {
  const [selected, setSelected] = useState<GameId>(initialGame),
    [tag, setTag] = useState<GameId | null>(autoPlay ? initialGame : null),
    [session, setSession] = useState<GameSession | null>(null),
    [screen, setScreen] = useState<"home" | "game" | "saving" | "result">(
      "home",
    );
  const [board, setBoard] = useState<
      Pick<Entry, "displayName" | "bestScore" | "bestTiebreakMs" | "rank">[]
    >([]),
    [total, setTotal] = useState(0),
    [mode, setMode] = useState<string>("checking"),
    [boardError, setBoardError] = useState(""),
    [loading, setLoading] = useState(true),
    [muted, setMuted] = useState(true),
    [result, setResult] = useState<Result | null>(null),
    [saveError, setSaveError] = useState(""),
    [collision, setCollision] = useState(false),
    [rename, setRename] = useState(""),
    [saving, setSaving] = useState(false),
    [notice, setNotice] = useState("");
  const pending = useRef<Pending | null>(null),
    submitting = useRef(false),
    finished = useRef(false),
    selectedRef = useRef(selected),
    [quitOpen, setQuitOpen] = useState(false);
  selectedRef.current = selected;
  const refresh = useCallback(async () => {
    const game = selectedRef.current;
    setBoardError("");
    try {
      const value = await request<{
        entries: typeof board;
        mode: string;
        total: number;
      }>(`leaderboard?gameId=${game}`);
      if (selectedRef.current === game) {
        setBoard(value.entries);
        setTotal(value.total);
        setMode(value.mode);
      }
    } catch (e) {
      setBoardError((e as Error).message);
      setMode("offline");
    } finally {
      if (selectedRef.current === game) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (screen !== "home") return;
    setLoading(true);
    setBoard([]);
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    return () => clearInterval(timer);
  }, [selected, screen, refresh]);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(PENDING);
      if (saved) {
        const value = JSON.parse(saved) as Pending;
        if (value.session?.id && value.session.token) {
          pending.current = value;
          setSelected(value.session.gameId);
          setScreen("saving");
          setSaveError(ui.anUnsavedRunIsWaitingRetryToCheckIts);
        }
      }
    } catch {}
  }, []);
  const save = useCallback(async (newName?: string) => {
    if (!pending.current || submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const p = pending.current;
      const value = await request<Result>("game/finish", {
        ...credentials(p.session),
        data: p.data,
        ...(newName ? { rename: newName } : {}),
      });
      setResult(value);
      setSelected(p.session.gameId);
      pending.current = null;
      try {
        localStorage.removeItem(PENDING);
      } catch {}
      setCollision(false);
      setScreen("result");
    } catch (e) {
      setSaveError((e as Error).message);
      setCollision(e instanceof RequestError && e.code === "NAME_COLLISION");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }, []);
  const finish = useCallback(
    (data: unknown) => {
      if (finished.current || !session) return;
      finished.current = true;
      setQuitOpen(false);
      const p = { session, data };
      pending.current = p;
      try {
        localStorage.setItem(PENDING, JSON.stringify(p));
      } catch {}
      setScreen("saving");
      void save();
    },
    [session, save],
  );
  const home = useCallback(() => {
    setScreen("home");
    setSession(null);
    setQuitOpen(false);
  }, []);
  useEffect(() => {
    if (screen !== "result") return;
    const timer = setTimeout(home, 4000);
    return () => clearTimeout(timer);
  }, [screen, home]);
  const quit = useCallback(() => {
    if (session)
      void request("game/abandon", credentials(session)).catch(() => {});
    finished.current = true;
    setNotice(ui.runEndedNoScoreSubmitted);
    home();
  }, [session, home]);
  useEffect(() => {
    if (screen !== "game") return;
    const visibility = () => {
      if (document.hidden) {
        quit();
        setNotice(ui.runInterruptedWhenTheTabLostVisibilityNoScore);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [screen, quit]);
  const start = (value: GameSession) => {
    setTag(null);
    setSession(value);
    finished.current = false;
    setResult(null);
    setNotice("");
    setScreen("game");
    setSelected(value.gameId);
  };
  const Game = session
    ? { reaction: Reaction, memory: Memory, aim: Aim, trivia: Trivia }[
        session.gameId
      ]
    : null;
  return (
    <div className="site-shell">
      <header className="masthead">
        <Link href="/" aria-label={ui.n7geeksArcadeHome} className="brand">
          <img src="/n7geeks.svg" alt={ui.n7geeks} />
          <span className="brand-divider" />
          <span>
            {ui.arcade}
            <span className="brand-slash">{"//"}</span>
          </span>
        </Link>
        <div className="masthead-right">
          <span className="edition">
            <i /> {ui.clubsWeekIntegrationEdition}
          </span>
          <button
            className="icon-button sound-toggle"
            aria-label={muted ? ui.enableSound : ui.muteSound}
            title={muted ? ui.soundOff : ui.soundOn}
            onClick={() => setMuted((v) => !v)}
          >
            {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
        </div>
      </header>
      {mode === "demo" && (
        <div className="mode-ribbon">
          {copy.demo}
          <span>{ui.localPlayground}</span>
        </div>
      )}
      {screen === "home" ? (
        <main>
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">
                <span className="little-star">✳</span>{" "}
                {ui.theN7geeksChallengeIsOn}
              </div>
              <h1>
                {copy.title}
                <br />
                <span>{copy.titleAccent}</span>
              </h1>
              <p>
                {copy.tagline} <span>{ui.pickYourGameLeaveYourTag}</span>
              </p>
              <a className="hero-link" href="#challenges">
                {ui.findYourChallenge}
                <ArrowDown size={16} />
              </a>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="art-cross">+</div>
              <span className="art-top">{ui.n7gPlayerOne}</span>
              <div className="hero-glasses">
                <svg viewBox="0 0 260 100">
                  <path d="M10 25L115 30L112 63Q110 94 53 86Q20 82 15 50ZM145 30L250 25L245 50Q240 82 207 86Q150 94 148 63Z" />
                  <path
                    className="glasses-bridge"
                    d="M113 40Q130 28 147 40M3 22l20-8M237 14l20 8"
                  />
                  <path
                    className="glasses-shine"
                    d="M37 38l19 2M63 40l12 1M169 40l20-1"
                  />
                </svg>
              </div>
              <span className="art-bottom">
                {ui.staySharp}
                <br />
                <b>{ui.playLoud}</b>
              </span>
              <div className="yellow-sticker">
                {ui.noExtraLives}
                <br />
                <b>{ui.justGoodVibes}</b>
                <span>↗</span>
              </div>
            </div>
          </section>
          <section className="arcade-floor" id="challenges">
            <div className="challenges">
              <div className="section-heading">
                <h2>
                  <span>01—04</span> {ui.chooseYourChallenge}
                </h2>
                <span>{ui.oneGameOneBoard}</span>
              </div>
              <div className="game-cards">
                {GAME_IDS.map((id) => (
                  <article
                    key={id}
                    className={`game-card ${id} ${selected === id ? "selected" : ""}`}
                  >
                    <div className="card-top">
                      <span>
                        {games[id].number} / {games[id].label}
                      </span>
                      <span>{games[id].jp}</span>
                    </div>
                    <Preview game={id} />
                    <div className="card-content">
                      <h3>{games[id].name}</h3>
                      <p>{games[id].description}</p>
                      <div className="card-bottom">
                        <span className="duration">◷ {games[id].duration}</span>
                        <div className="card-actions">
                          <button
                            className="rank-action"
                            onClick={() => setSelected(id)}
                            aria-label={dynamicCopy.viewRanks(games[id].name)}
                          >
                            {ui.ranks}
                          </button>
                          <button
                            className="play-button"
                            onClick={() => {
                              setSelected(id);
                              setTag(id);
                            }}
                            aria-label={dynamicCopy.playGame(games[id].name)}
                          >
                            {ui.play}
                            <ArrowUpRight size={17} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <aside className="leaderboard" aria-label={ui.gameLeaderboard}>
              <div className="board-header">
                <div>
                  <span className="eyebrow">
                    {ui.theBraggingRightsDepartment}
                  </span>
                  <h2>
                    {ui.theLeaderboard}
                    <span>↗</span>
                  </h2>
                </div>
                <span className="live-dot">
                  <i />{" "}
                  {mode === "demo"
                    ? ui.demo
                    : mode === "live"
                      ? ui.live
                      : mode === "offline"
                        ? ui.offline
                        : ui.connecting}
                </span>
              </div>
              <div
                className="board-tabs"
                role="tablist"
                aria-label={ui.chooseLeaderboard}
              >
                {GAME_IDS.map((id) => (
                  <button
                    role="tab"
                    aria-selected={selected === id}
                    aria-controls="board-panel"
                    id={`tab-${id}`}
                    key={id}
                    onClick={() => setSelected(id)}
                  >
                    {games[id].label}
                  </button>
                ))}
              </div>
              <div
                id="board-panel"
                role="tabpanel"
                aria-labelledby={`tab-${selected}`}
              >
                <div className="board-game">
                  <span>{games[selected].name}</span>
                  <span>
                    {ui.top10}
                    <ChevronRight size={13} />
                  </span>
                </div>
                <div className="board-columns">
                  <span>{ui.rankPlayer}</span>
                  <span>{ui.bestScore}</span>
                </div>
                <div className="board-rows" aria-live="polite">
                  {loading ? (
                    <div className="board-empty">
                      <Loader2 className="spin" />
                      <b>{ui.loadingTheBoard}</b>
                    </div>
                  ) : boardError ? (
                    <div className="board-empty">
                      <b>{ui.boardOffline}</b>
                      <p>{boardError}</p>
                      <button
                        className="text-button"
                        onClick={() => void refresh()}
                      >
                        {ui.tryAgain}
                      </button>
                    </div>
                  ) : board.length ? (
                    board.map((entry, i) => (
                      <div
                        className={`board-row ${i === 0 ? "first" : ""}`}
                        key={entry.displayName}
                      >
                        <span className="rank">
                          {i === 0 ? "♛" : String(entry.rank).padStart(2, "0")}
                        </span>
                        <span className="player-name" dir="auto">
                          {entry.displayName}
                          {i === 0 && <small>{ui.theOneToBeat}</small>}
                        </span>
                        <b>
                          {entry.bestScore.toLocaleString()}
                          <small> / 1000</small>
                        </b>
                      </div>
                    ))
                  ) : (
                    <div className="board-empty">
                      <div className="empty-podium">
                        <i>2</i>
                        <i>1</i>
                        <i>3</i>
                      </div>
                      <b>{copy.emptyBoard}</b>
                      <p>{ui.yourTagCouldBeRightHere}</p>
                      <button
                        className="button blue"
                        onClick={() => setTag(selected)}
                      >
                        {ui.setTheFirstScore}
                        <ArrowUpRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="board-footer">
                  <span>
                    <i /> {ui.autoRefresh10s}
                  </span>
                  <span>
                    {total} {ui.player}
                    {total !== 1 ? "S" : ""}
                  </span>
                </div>
              </div>
            </aside>
          </section>
          {result && (
            <div className="last-result" role="status">
              <Zap size={18} />
              <b>{result.displayName}</b>
              <span>{games[result.gameId].name}</span>
              <span>
                {ui.yourResult}
                <b>{result.score}</b>
              </span>
              <span>
                {ui.rank}
                <b>#{result.rank}</b>
              </span>
              <span>
                {ui.best}
                <b>{result.best}</b>
              </span>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          <section className="bottom-strip">
            <span className="stripe-label">{ui.builtForTheBooth}</span>
            <p>{ui.noSignupNoDownloadsJustYouAndTheChallenge}</p>
            <span className="street-stamp">{ui.n7geeksEstToPlay}</span>
          </section>
        </main>
      ) : (
        <main className="play-main">
          {screen === "game" && session && Game && (
            <section className={`game-panel game-${session.gameId}`}>
              <div className="play-heading">
                <div>
                  <span className="eyebrow">
                    {session.displayName}
                    {ui.playerConnected}
                  </span>
                  <h1>{games[session.gameId].name}</h1>
                </div>
                <button
                  className="text-button"
                  onClick={() => setQuitOpen(true)}
                >
                  {ui.quit}
                  <X size={16} />
                </button>
              </div>
              <p className="instructions">
                {games[session.gameId].instruction}
              </p>
              <Game session={session} onFinish={finish} muted={muted} />
              <div className="controls-hint">
                {games[session.gameId].control}
                <span>{ui.score1000}</span>
              </div>
            </section>
          )}
          {screen === "saving" && (
            <section className="result-panel">
              <span className="eyebrow">{ui.runCompleteSaveStatus}</span>
              <h1>{saving ? ui.lockingItIn : ui.yourRunIsReady}</h1>
              {saving ? (
                <Loader2 size={48} className="spin" />
              ) : (
                <>
                  <p className="error-text" role="alert">
                    {saveError}
                  </p>
                  {collision && (
                    <label className="field-label">
                      {ui.chooseADifferentTag}
                      <input
                        value={rename}
                        onChange={(e) => setRename(e.target.value)}
                        placeholder={ui.aNewTagForThisRun}
                      />
                    </label>
                  )}
                  <button
                    className="button blue"
                    onClick={() => void save(collision ? rename : undefined)}
                    disabled={collision && !rename.trim()}
                  >
                    {collision ? ui.saveWithNewTag : copy.retry}{" "}
                    <ArrowUpRight size={18} />
                  </button>
                  <button
                    className="text-button"
                    onClick={() => {
                      if (
                        window.confirm(
                          ui.discardThisUnsavedRunItWillNotAppearOn,
                        )
                      ) {
                        pending.current = null;
                        try {
                          localStorage.removeItem(PENDING);
                        } catch {}
                        home();
                      }
                    }}
                  >
                    {ui.discardRun}
                  </button>
                  <p className="fine-print">
                    {ui.yourRunStaysOnThisBrowserUntilItSaves}
                  </p>
                </>
              )}
            </section>
          )}
          {screen === "result" && result && (
            <section className="result-panel">
              <span className="result-badge">
                {result.personalBest ? copy.newBest : ui.notBadRunItBack}
              </span>
              <h1 className="result-score">
                {result.score}
                <small> / 1000</small>
              </h1>
              <h2>{ui.youMadeTheBoard}</h2>
              <div className="result-details">
                <span>
                  {ui.rank2}
                  <b>#{String(result.rank).padStart(2, "0")}</b>
                </span>
                <span>
                  {ui.personalBest}
                  <b>{result.best}</b>
                </span>
              </div>
              <button className="button blue" onClick={home}>
                {copy.back}
                <ArrowUpRight size={18} />
              </button>
              <p className="fine-print">
                {ui.savedReturningTo}
                {games[result.gameId].name} {ui.boardIn4Seconds}
              </p>
            </section>
          )}
        </main>
      )}
      <footer className="site-footer">
        <span>
          © {new Date().getFullYear()} {ui.n7geeks2}
          <span className="footer-blue">{"//"}</span> {ui.madeOfCuriosity}
        </span>
        <span>{ui.fourChallengesFourIndependentBoards}</span>
        <a href="/admin">
          {ui.organizerAccess}
          <ArrowUpRight size={12} />
        </a>
      </footer>
      {tag && (
        <TagDialog game={tag} onClose={() => setTag(null)} onStart={start} />
      )}
      {quitOpen && (
        <QuitDialog onCancel={() => setQuitOpen(false)} onQuit={quit} />
      )}
    </div>
  );
}
function QuitDialog({
  onCancel,
  onQuit,
}: {
  onCancel: () => void;
  onQuit: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog ref={ref} className="tag-dialog" onCancel={onCancel}>
      <div className="dialog-inner">
        <span className="eyebrow">{ui.endThisRun}</span>
        <h2>{ui.callItADay}</h2>
        <p>{ui.quittingEndsYourRunWithoutSubmittingAScoreTimed}</p>
        <button className="button blue full" onClick={onCancel}>
          {ui.keepPlaying}
        </button>
        <button className="text-button full" onClick={onQuit}>
          {ui.quitWithoutSaving}
        </button>
      </div>
    </dialog>
  );
}
