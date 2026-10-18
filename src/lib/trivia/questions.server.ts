import "server-only";
import { randomInt } from "node:crypto";
import { advancedRows } from "./advanced.server";
import type { Difficulty } from "../rules";
export const categories = [
  "linux",
  "python",
  "cybersecurity",
  "data-ai",
  "dev-web",
] as const;
export interface Question {
  id: string;
  category: (typeof categories)[number];
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  options: { id: string; text: string }[];
  correctOptionId: string;
  explanation: string;
}
const rows: [string, Question["category"], string, string[], number, string][] =
  [
    [
      "L01",
      "linux",
      "Which command lists files in the current directory?",
      ["ls", "cd", "pwd", "echo"],
      0,
      "ls lists directory contents.",
    ],
    [
      "L02",
      "linux",
      "Which character usually represents your home directory in a Linux shell?",
      ["#", "~", "*", "?"],
      1,
      "A tilde expands to your home directory.",
    ],
    [
      "L03",
      "linux",
      "What does pwd print?",
      [
        "Process list",
        "Current working directory",
        "User password",
        "File permissions",
      ],
      1,
      "pwd means print working directory.",
    ],
    [
      "L04",
      "linux",
      "Which tool commonly searches text for a matching pattern?",
      ["mkdir", "mv", "grep", "touch"],
      2,
      "grep searches text using patterns.",
    ],
    [
      "L05",
      "linux",
      "In chmod 755 file, what can group members do?",
      [
        "Read and execute",
        "Read and write",
        "Execute and write",
        "Read, write, and execute",
      ],
      0,
      "The group digit 5 is read (4) plus execute (1).",
    ],
    [
      "L06",
      "linux",
      "What is /dev/null commonly used for?",
      [
        "Keeping user passwords",
        "Discarding unwanted output",
        "Installing packages",
        "Backing up the home folder",
      ],
      1,
      "Writes to /dev/null are discarded.",
    ],
    [
      "P01",
      "python",
      "Which syntax creates a Python list?",
      ["{1, 2}", "(1, 2)", "[1, 2]", "<1, 2>"],
      2,
      "Square brackets create a list.",
    ],
    [
      "P02",
      "python",
      "What is len([2, 4, 6])?",
      ["2", "3", "6", "12"],
      1,
      "The list has three elements.",
    ],
    [
      "P03",
      "python",
      "What numbers does list(range(3)) contain?",
      ["1,2,3", "0,1,2,3", "0,1,2", "3"],
      2,
      "range starts at zero and excludes its stop value.",
    ],
    [
      "P04",
      "python",
      "What does 'hi'.upper() return?",
      ["hi", "Hi", "HI", "ERROR"],
      2,
      "upper converts letters to uppercase.",
    ],
    [
      "P05",
      "python",
      "What is the main risk of using items=[] as a default function argument?",
      [
        "It is immutable",
        "The same list may be reused across calls",
        "Python immediately crashes",
        "Lists cannot be arguments",
      ],
      1,
      "Default arguments are evaluated once when the function is defined.",
    ],
    [
      "P06",
      "python",
      "What is set([1, 1, 2, 2]) conceptually?",
      [
        "A collection containing unique 1 and 2",
        "A four-element ordered list",
        "A dict with two keys",
        "Syntax error",
      ],
      0,
      "A set contains distinct elements.",
    ],
    [
      "C01",
      "cybersecurity",
      "HTTPS normally protects web traffic using which technology?",
      ["DNS", "TLS", "FTP", "SSH keys only"],
      1,
      "TLS encrypts and authenticates HTTPS connections.",
    ],
    [
      "C02",
      "cybersecurity",
      "A fake login email that tries to steal credentials is an example of…",
      ["Phishing", "Load balancing", "Compiling", "Compression"],
      0,
      "Phishing impersonates a trusted party to steal information.",
    ],
    [
      "C03",
      "cybersecurity",
      "What does MFA stand for?",
      [
        "Multi-Factor Authentication",
        "Main Firewall Access",
        "Multiple File Archive",
        "Managed Fast Algorithm",
      ],
      0,
      "MFA combines different authentication factors.",
    ],
    [
      "C04",
      "cybersecurity",
      "Why should software receive security updates?",
      [
        "They always increase screen brightness",
        "They can patch known vulnerabilities",
        "They replace every password",
        "They guarantee no future attacks",
      ],
      1,
      "Security patches fix known vulnerabilities.",
    ],
    [
      "C05",
      "cybersecurity",
      "What does the principle of least privilege recommend?",
      [
        "Give everyone admin rights",
        "Grant only the access needed for a task",
        "Use the same password everywhere",
        "Disable all logs",
      ],
      1,
      "Limit each identity to the permissions it needs.",
    ],
    [
      "C06",
      "cybersecurity",
      "Why are unique salts used when hashing passwords?",
      [
        "To make passwords readable",
        "To reduce effectiveness of precomputed hash attacks",
        "To remove the need to hash",
        "To speed up brute forcing",
      ],
      1,
      "Unique salts prevent reuse of precomputed hash tables across passwords.",
    ],
    [
      "D01",
      "data-ai",
      "What does CSV stand for?",
      [
        "Compressed Script Value",
        "Comma-Separated Values",
        "Central Server Version",
        "Computer Syntax View",
      ],
      1,
      "CSV stores tabular text with comma separators.",
    ],
    [
      "D02",
      "data-ai",
      "A machine-learning model generally learns patterns from…",
      ["Training data", "Monitor brightness", "USB cables", "DNS records only"],
      0,
      "Training data supplies examples for learning.",
    ],
    [
      "D03",
      "data-ai",
      "Which SQL clause groups rows for aggregate calculations?",
      ["WHERE", "ORDER BY", "GROUP BY", "LIMIT"],
      2,
      "GROUP BY collects rows into groups for aggregates.",
    ],
    [
      "D04",
      "data-ai",
      "A false positive means…",
      [
        "A real positive correctly predicted positive",
        "A real negative incorrectly predicted positive",
        "A real positive predicted negative",
        "A missing prediction",
      ],
      1,
      "The prediction is positive, but the actual class is negative.",
    ],
    [
      "D05",
      "data-ai",
      "What is data leakage in machine learning?",
      [
        "Using future/unavailable information during model development",
        "Deleting a CSV on purpose",
        "Encrypting a dataset",
        "Compressing a parquet file",
      ],
      0,
      "Leakage includes information unavailable at prediction time.",
    ],
    [
      "D06",
      "data-ai",
      "Why is Apache Spark useful for very large datasets?",
      [
        "It processes data only in a web browser",
        "It supports distributed data processing",
        "It replaces all SQL syntax",
        "It works only with spreadsheets",
      ],
      1,
      "Spark distributes computation across machines.",
    ],
    [
      "W01",
      "dev-web",
      "What is HTML mainly used to describe?",
      [
        "Webpage structure and content",
        "Computer fan speed",
        "Password hashing",
        "Wi-Fi channels",
      ],
      0,
      "HTML describes page content and its structure.",
    ],
    [
      "W02",
      "dev-web",
      "What is CSS mainly used for?",
      [
        "Database backups",
        "Styling web pages",
        "Compiling Python",
        "Tracking IP routes",
      ],
      1,
      "CSS controls presentation and layout.",
    ],
    [
      "W03",
      "dev-web",
      "Which HTTP method is normally used to retrieve a resource?",
      ["GET", "DELETE", "PATCH", "POST"],
      0,
      "GET requests retrieve a representation of a resource.",
    ],
    [
      "W04",
      "dev-web",
      "What does git commit primarily do?",
      [
        "Permanently delete the remote repo",
        "Record a snapshot of staged changes",
        "Publish a website automatically",
        "Install dependencies",
      ],
      1,
      "A commit records the staged snapshot in repository history.",
    ],
    [
      "W05",
      "dev-web",
      "Linear search through an unsorted list has worst-case time complexity…",
      ["O(1)", "O(log n)", "O(n)", "O(n²)"],
      2,
      "In the worst case, every element must be checked.",
    ],
    [
      "W06",
      "dev-web",
      "A Git merge conflict usually means…",
      [
        "Git needs human help combining overlapping edits",
        "The internet connection is down",
        "The repo has no commits",
        "A file has become read-only",
      ],
      0,
      "Overlapping changes require a decision about the final content.",
    ],
  ];
export const questions: Question[] = rows.map(
  ([id, category, prompt, options, correct, explanation]) => ({
    id,
    category,
    prompt,
    options: options.map((text, i) => ({ id: `${id}-${i}`, text })),
    correctOptionId: `${id}-${correct}`,
    explanation,
    difficulty: Number(id.slice(1)) <= 4 ? "easy" : "medium",
  }),
);
questions.push(
  ...advancedRows.map(
    ([id, category, difficulty, prompt, options, correct, explanation]) => ({
      id,
      category,
      difficulty,
      prompt,
      options: options.map((text, i) => ({ id: `${id}-${i}`, text })),
      correctOptionId: `${id}-${correct}`,
      explanation,
    }),
  ),
);
export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function chooseQuestions() {
  const selected: Question[] = [];
  function pick(
    category: Question["category"],
    difficulty: Difficulty,
    originalEntry = false,
  ) {
    const pool = questions.filter(
      (q) =>
        q.category === category &&
        q.difficulty === difficulty &&
        !selected.some((chosen) => chosen.id === q.id) &&
        (!originalEntry || Number(q.id.slice(1)) <= 4),
    );
    const question = pool[randomInt(pool.length)];
    selected.push({ ...question, options: shuffle(question.options) });
  }
  // Everyone gets five genuinely approachable questions from the original bank.
  for (const category of shuffle(categories)) pick(category, "easy", true);
  const bonusCategories = shuffle(categories);
  for (const category of bonusCategories.slice(0, 3)) pick(category, "easy");
  for (const category of shuffle(categories)) pick(category, "medium");
  for (const category of bonusCategories.slice(3)) pick(category, "hard");
  // Exactly three questions per topic, with the same 8/5/2 difficulty mix each run.
  return selected;
}
