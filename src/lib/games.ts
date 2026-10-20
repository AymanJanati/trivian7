export const GAME_IDS = [
  "reaction",
  "memory",
  "aim",
  "color",
  "numbers",
  "rhythm",
  "trivia",
] as const;
export type GameId = (typeof GAME_IDS)[number];
// Keep historical IDs for stored results and organizer exports.
export const ACTIVE_GAME_IDS = [
  "reaction",
  "memory",
  "aim",
  "color",
  "numbers",
  "rhythm",
] as const;
export type ActiveGameId = (typeof ACTIVE_GAME_IDS)[number];
export function isActiveGame(value: string): value is ActiveGameId {
  return ACTIVE_GAME_IDS.some((id) => id === value);
}
export const games = {
  reaction: {
    name: "REACTION.EXE",
    label: "REFLEX",
    jp: "反応",
    number: "01",
    description: "Wait for blue. Beat your own reflexes.",
    duration: "~30 SEC",
    instruction:
      "Five trials. Wait for blue, then hit SPACE or tap. An early tap costs the trial.",
    control: "SPACE / ENTER / TAP",
    symbol: "↯",
  },
  memory: {
    name: "MEMORY.STACK",
    label: "MEMORY",
    jp: "記憶",
    number: "02",
    description: "Fresh patterns. Faster flashes. Survive ten rounds.",
    duration: "~90 SEC",
    instruction:
      "Ten fresh sequences, from 3 to 12 tiles. Flashes speed up every round. Repeat before the input timer ends. One wrong tile ends the run.",
    control: "KEYS 1–9 / TAP",
    symbol: "▦",
  },
  aim: {
    name: "AIM//TRAINER",
    label: "PRECISION",
    jp: "照準",
    number: "03",
    description: "Twenty targets. Thirty seconds. Lock in.",
    duration: "~30 SEC",
    instruction:
      "Hit twenty targets before thirty seconds run out. Speed earns a bonus. Empty clicks cost time.",
    control: "MOUSE / TOUCH",
    symbol: "◎",
  },
  color: {
    name: "COLOR.CLASH",
    label: "FOCUS",
    jp: "集中",
    number: "04",
    description: "Read the ink. Ignore the word. Stay focused.",
    duration: "~30 SEC",
    instruction:
      "20 rounds. Choose the INK color, not the word. Deadlines shrink as distractions increase. Keys 1–4 or tap.",
    control: "KEYS 1–4 / TAP",
    symbol: "Aa",
  },
  numbers: {
    name: "NUMBER.RUSH",
    label: "LOGIC",
    jp: "計算",
    number: "05",
    description: "Quick maths. Bigger problems. Beat the clock.",
    duration: "~1 MIN",
    instruction:
      "20 fresh problems. Choose the answer before time runs out. Operations get harder and deadlines shrink. Keys 1–4 or tap.",
    control: "KEYS 1–4 / TAP",
    symbol: "±",
  },
  rhythm: {
    name: "RHYTHM.GRID",
    label: "TIMING",
    jp: "律動",
    number: "06",
    description: "Four lanes. Find the beat. Keep your streak.",
    duration: "~40 SEC",
    instruction:
      "Hit each lane as its note crosses the blue line. Patterns accelerate and timing windows tighten. Use D F J K, keys 1–4 or tap. Visual timing works with sound off.",
    control: "D F J K / KEYS 1–4 / TAP",
    symbol: "♫",
  },
  trivia: {
    name: "GEEK.CHECK",
    label: "KNOWLEDGE",
    jp: "知識",
    number: "04",
    description: "Entry-level wins. A few brain-benders. All geeks welcome.",
    duration: "~2 MIN",
    instruction:
      "15 tech questions: 8 easy, 5 medium, 2 hard. Choose an answer to move straight on. Your total score is revealed at the end.",
    control: "KEYS 1–4 / TAP",
    symbol: "{ }",
  },
} as const;
export interface Entry {
  id: string;
  gameId: GameId;
  rulesVersion: number;
  displayName: string;
  normalizedName: string;
  bestScore: number;
  bestTiebreakMs: number;
  attemptCount: number;
  bestAchievedAt: string;
  createdAt: string;
  updatedAt: string;
  rank?: number;
}
export interface Result {
  score: number;
  tiebreakMs: number;
  best: number;
  rank: number;
  personalBest: boolean;
  displayName: string;
  gameId: GameId;
}
export interface PublicQuestion {
  id: string;
  category: string;
  difficulty: string;
  prompt: string;
  options: { id: string; text: string }[];
  timeLimitMs: number;
  remainingMs: number;
  openedAt: number;
  deadline: number;
  index: number;
  total: number;
  maxPoints: number;
}
export interface GameSession {
  id: string;
  token: string;
  gameId: GameId;
  displayName: string;
  sequences?: number[][];
  challenges?: import("./new-challenges").PublicChallenge[];
}
export const copy = {
  title: "PICK A CHALLENGE.",
  titleAccent: "OWN THE BOARD.",
  tagline: "Six ways to show up. One chance to stand out.",
  emptyBoard: "NO SCORES YET. BE THE FIRST.",
  tagTitle: "ENTER YOUR TAG",
  existingTitle: "TAG ALREADY ON THIS BOARD",
  yes: "YES, THAT’S ME",
  no: "NO, CHANGE TAG",
  retry: "COULD NOT SAVE — RETRY",
  back: "BACK TO ARCADE",
  demo: "DEMO MODE — SCORES NOT SHARED",
  live: "LIVE COMPETITION",
  newBest: "NEW PERSONAL BEST!",
};
