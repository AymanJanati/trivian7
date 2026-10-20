"use client";
import { ui, dynamicCopy } from "@/lib/ui-copy";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { ACTIVE_GAME_IDS, games, type Entry, type GameId } from "@/lib/games";
import { request, RequestError } from "@/lib/client";
export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false),
    [password, setPassword] = useState(""),
    [game, setGame] = useState<GameId>("reaction"),
    [entries, setEntries] = useState<Entry[]>([]),
    [mode, setMode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const value = await request<{ entries: Entry[]; mode: string }>(
        `admin/board?gameId=${game}`,
      );
      setEntries(value.entries);
      setMode(value.mode);
      setAuthenticated(true);
    } catch (e) {
      if (e instanceof RequestError && e.status === 401)
        setAuthenticated(false);
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [game]);
  useEffect(() => {
    setEntries([]);
    setConfirmation("");
    void load();
  }, [load]);
  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await request("admin/login", { password });
      setPassword("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (entry: Entry) => {
    if (
      !window.confirm(
        dynamicCopy.deleteTag(entry.displayName, games[game].name),
      )
    )
      return;
    setBusy(true);
    try {
      await request("admin/delete", {
        gameId: game,
        name: entry.displayName,
        confirmation: "DELETE",
      });
      setMessage(dynamicCopy.deletedTag(entry.displayName, games[game].name));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    setBusy(true);
    setError("");
    try {
      await request("admin/reset", { gameId: game, confirmation });
      setConfirmation("");
      setMessage(dynamicCopy.resetGame(games[game].name));
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="admin-shell">
      <div className="admin-top">
        <h1>
          {ui.n7geeks3}
          <span>{"//"}</span> {ui.control}
        </h1>
        <Link className="text-button" href="/">
          <ArrowLeft size={14} /> {ui.backToArcade}
        </Link>
      </div>
      {!authenticated ? (
        <section className="admin-login">
          <span className="eyebrow">{ui.organizerAccess2}</span>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginTop: 15 }}>
            {ui.keepTheArcadeInOrder}
          </h2>
          <p>
            {ui.localDemoPassword}
            <code>{ui.localArcadeDemo}</code>
            {ui.liveModeUsesYourConfiguredAdminPassword}
          </p>
          <form onSubmit={login}>
            <label className="field-label" htmlFor="admin-password">
              {ui.adminPassword}
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button className="button blue" disabled={busy}>
              {busy ? <Loader2 className="spin" size={18} /> : ui.signIn}
            </button>
          </form>
        </section>
      ) : (
        <>
          <div className="admin-status">
            {mode === "demo"
              ? ui.demoModeScoresNotShared
              : ui.liveModeConnectedToNeon}
          </div>
          <div className="admin-toolbar">
            <div className="admin-tabs">
              {ACTIVE_GAME_IDS.map((id) => (
                <button
                  key={id}
                  aria-pressed={id === game}
                  onClick={() => setGame(id)}
                >
                  {games[id].name}
                </button>
              ))}
            </div>
            <button
              className="text-button"
              onClick={async () => {
                await request("admin/logout", {});
                setAuthenticated(false);
              }}
            >
              {ui.signOut}
            </button>
          </div>
          <div className="admin-export">
            <span>
              <Download
                size={12}
                style={{ display: "inline", marginRight: 6 }}
              />{" "}
              {ui.exportBoards}
            </span>
            {ACTIVE_GAME_IDS.map((id) => (
              <a key={id} href={`/api/admin/export?gameId=${id}`}>
                {games[id].name}
                {ui.csv}
              </a>
            ))}
          </div>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{ui.rank3}</th>
                  <th>{ui.player2}</th>
                  <th>{ui.best2}</th>
                  <th>{ui.attempts}</th>
                  <th>{ui.achievedUtc}</th>
                  <th>{ui.action}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>#{entry.rank}</td>
                    <td dir="auto">{entry.displayName}</td>
                    <td>{entry.bestScore}</td>
                    <td>{entry.attemptCount}</td>
                    <td>
                      {new Date(entry.bestAchievedAt)
                        .toISOString()
                        .replace("T", " ")
                        .slice(0, 19)}
                    </td>
                    <td>
                      <button
                        disabled={busy}
                        onClick={() => void remove(entry)}
                      >
                        {ui.delete}
                      </button>
                    </td>
                  </tr>
                ))}
                {!entries.length && (
                  <tr>
                    <td colSpan={6}>{busy ? ui.loading : ui.noScoresYet}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <section className="admin-reset">
            <h2>
              {ui.reset}
              {games[game].name}
            </h2>
            <p>
              {ui.thisPermanentlyDeletesThisGameSEntireBoardAttempts}
              <strong>
                {ui.reset2}
                {game.toUpperCase()}
              </strong>{" "}
              {ui.toConfirm}
            </p>
            <input
              aria-label={ui.resetConfirmationPhrase}
              autoComplete="off"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
            <button
              className="button"
              disabled={confirmation !== `RESET ${game.toUpperCase()}` || busy}
              onClick={() => void reset()}
            >
              {ui.resetThisGame}
            </button>
          </section>
        </>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status" style={{ margin: "20px 0" }}>
          {message}
        </p>
      )}
    </main>
  );
}
