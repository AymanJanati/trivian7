import type { Entry } from "./games";
import { isActiveGame } from "./games";

export function ultraRankings(boards: Entry[][]) {
  const players = new Map<
    string,
    { displayName: string; score: number; played: number; achievedAt: string }
  >();
  for (const rows of boards)
    for (const row of rows) {
      if (!isActiveGame(row.gameId)) continue;
      const p = players.get(row.normalizedName) ?? {
        displayName: row.displayName,
        score: 0,
        played: 0,
        achievedAt: row.bestAchievedAt,
      };
      p.score += row.bestScore;
      p.played++;
      if (row.bestAchievedAt > p.achievedAt) p.achievedAt = row.bestAchievedAt;
      players.set(row.normalizedName, p);
    }
  return [...players.values()].sort(
    (a, b) =>
      b.score - a.score ||
      a.achievedAt.localeCompare(b.achievedAt) ||
      a.displayName.localeCompare(b.displayName),
  );
}
