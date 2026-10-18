export const GAME_IDS = ["reaction", "memory", "aim", "trivia"] as const;
export type GameId = (typeof GAME_IDS)[number];
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
  trivia: {
    name: "GEEK.CHECK",
    label: "KNOWLEDGE",
    jp: "知識",
    number: "04",
    description: "15 questions. Easy to start. Hard to master.",
    duration: "~2 MIN",
    instruction:
      "15 tech questions. Difficulty ramps from easy to hard. Harder answers earn more; accuracy matters most, speed adds a bonus.",
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
}
export const copy = {
  title: "PICK A CHALLENGE.",
  titleAccent: "OWN THE BOARD.",
  tagline: "Four ways to show up. One chance to stand out.",
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
