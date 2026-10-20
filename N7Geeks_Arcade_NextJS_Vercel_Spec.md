> Update 2026-10-20: Add Color Clash, Number Rush and Rhythm Grid with increasing difficulty. Six active games now use rotating story-style leaderboards with manual selection and pause. The header Ultra Score sums same-tag personal bests across all six games (6,000 maximum), requiring completion of all six. Geek Check remains retired. See README.md for current rules.

> Update 2026-10-20: Geek Check is retired. The arcade now offers Reaction, Memory and Aim only. Hide its game and leaderboard controls, reject public trivia play routes/API requests, and preserve historical database records. This supersedes earlier four-game requirements below.

# N7GEEKS // ARCADE
> **Latest Geek Check edit (2026-10-18):** Format 3 uses 8 easy, 5 medium and 2 hard questions, including five guaranteed original entry questions. After each answer, advance immediately without showing or returning correctness, correct answers or explanations. Only the final score is public. See README.md and `src/lib/rules.ts` for current rules; this supersedes the older quiz feedback and difficulty instructions below.
> **Difficulty update (user request, 2026-10-18):** The original Memory and Geek Check rules below are superseded by the current format documented in README.md and `src/lib/rules.ts`. Memory now uses 10 fresh independent sequences (3–12 tiles) with accelerating playback and input deadlines. Geek Check now uses 15 progressively harder questions from a 90-question bank, with difficulty-weighted scoring. Reaction and Aim rules remain unchanged. Prior Memory/Trivia scores are retained separately as format 1, rather than mixed with format 2 rankings.
## Full-stack Next.js + Vercel | Codex-ready implementation specification (v2)

> **Instructions for Codex:** IMPLEMENT the entire application, not a mockup or plan. This is ONE FULL-STACK NEXT.JS REPOSITORY deployed as ONE Vercel project: Next.js App Router frontend, Next.js server Route Handlers backend, Neon Postgres database attached through Vercel Marketplace, Drizzle ORM/migrations, and a protected admin dashboard. There must be **no separate Express/Nest/Fastify/Supabase API server** and no independently deployed backend service. Follow all game logic, independent name/score rules, and design direction exactly. Include real playable games, tests, a locally runnable demo, automatic production schema migrations, `.env.example`, a deploy button, and instructions for a Vercel + Neon deployment. Do not merely describe the implementation—write and verify it. Never imply the website has been deployed or credentials provisioned if you have not actually done so.

**Project:** N7Geeks Clubs Week / Integration Week booth game  
**Working title:** `N7GEEKS // ARCADE`  
**Tagline:** `PICK A CHALLENGE. OWN THE BOARD.`  
**Primary language:** English (write all UI copy in editable translation/constants files for easy future French/Arabic support).  
**Format:** Responsive browser game, excellent on a shared stand laptop and usable on phones via a QR code.  
**Priority:** Smooth, memorable game feel + correct competition logic + beautiful non-generic visuals.

**Deployment target (non-negotiable):** One Git repository → one Vercel Next.js project → Vercel Marketplace Neon Postgres → one live URL, with no hand-written SQL to paste and no second API deployment. The Vercel import/deploy flow may still require account authorization, Neon provisioning/approval, and entering admin secrets; never promise that actual provisioning is literally zero-click.

**Architecture decision:** This specification supersedes any previous Supabase-first plan. PostgreSQL stays, but **Neon managed from Vercel** is the production database. The website and server API run together inside the Next.js app.

---

# 1. Core concept

Visitors arrive at the N7Geeks stand, choose **one mini-game**, enter a nickname, play that game, and compete on **that game's own leaderboard**. They never need to play all four games.

The four separate competitions are:

1. **REACTION.EXE** — reaction time test.
2. **MEMORY.STACK** — repeat an increasing sequence of glowing tiles.
3. **AIM//TRAINER** — hit appearing targets quickly.
4. **GEEK.CHECK** — timed multiple-choice questions on tech.

## Non-negotiable rules

- **Exactly four playable games in MVP.** No combined tournament score and no global leaderboard.
- Each game has **its own score, leaderboard, and nickname namespace**.
- A nickname that exists in Reaction **must not** be considered taken in Memory, Aim, or Trivia.
- A nickname that exists in the **selected game's leaderboard** triggers a returning-player choice (see Section 3).
- Returning players can replay and improve their **best score**. Do not create duplicate leaderboard rows for the same normalized nickname within the same game.
- At the end of **any** game: save its result, briefly show feedback, then return to the **main game selection + leaderboard screen**. Keep the completed game selected so its leaderboard is immediately visible.
- Scores must be stored in a **shared persistent production database**, visible across devices and after refresh/redeployment. `localStorage` alone is NOT a production leaderboard.
- No account registration, email, password, or personal information required for players. Use nicknames only.

# 2. Primary experience / screen flow

```text
OPEN SITE
    |
    v
HOME: brand hero + 4 game cards + selected game's leaderboard
    |
    | user clicks PLAY on one game
    v
NICKNAME MODAL: "Enter your tag"
    |
    | nickname not in THIS game's leaderboard
    |-----------------------------------------> START SELECTED GAME
    |
    | nickname IS in THIS game's leaderboard
    v
"This tag is already on the [GAME] board. Is it yours?"
    |                                 |
    | [YES, THAT'S ME]                | [NO, CHANGE TAG]
    v                                 v
START SELECTED GAME               EDIT NICKNAME
    |
    v
GAME ENDS -> SERVER SAVES ATTEMPT / UPDATES PERSONAL BEST
    |
    v
RESULT OVERLAY (approx. 4 seconds; can dismiss early)
    |
    v
HOME: four game cards + leaderboard for the game just played
    + optional visible "Your result: X | Rank: #Y | Best: Z" toast/card
```

## Home screen

- A recognizable **N7Geeks wordmark/logo area**, large arcade headline, short invitation.
- Four distinctive, individually selectable game cards. Each contains:
  - Game name and small identifier (`01` / `02` / `03` / `04`).
  - One-sentence explanation.
  - Typical game length (rough estimate, not a timer promise).
  - A small live/animated preview, ideally generated with CSS/SVG/canvas.
  - A clear `PLAY` button.
  - A `VIEW RANKS` action or clicking a leaderboard tab associated with the game.
- A **leaderboard panel** that shows *only one game's scores at a time*. It can switch via four tabs or selecting a game card. Display TOP 10, and current user's position after a run even if outside top 10.
- Empty leaderboard state: `NO SCORES YET. BE THE FIRST.`
- Leaderboard columns: `RANK`, `PLAYER`, `BEST SCORE`. Optionally show that game's tie-break metric in smaller text.
- Refresh leaderboard on entering Home, after result submission, on tab change, and periodically while Home is open (for example, every 10 seconds). Avoid real-time infrastructure unless it is simple.
- Keep the interface focused: there should NOT be a multi-game registration form or an overall score.

## Nickname entry

- Click `PLAY` on a game -> open nickname modal before gameplay.
- Text: `ENTER YOUR TAG` / `This name will appear on the [selected game] leaderboard.`
- Input: 2–16 visible characters after trimming, allowing Unicode letters (including Arabic), digits, spaces, `_`, and `-`; reject empty or obviously invalid input. Normalize multiple spaces.
- Preserve original display capitalization; compare names case-insensitively and after Unicode NFKC normalization/trim/whitespace collapse. E.g., `Nova`, ` nova ` and `NOVA` are the **same nickname within one game**.
- Nickname availability check **must include game ID**. The database has a unique constraint on `(game_id, normalized_name)`, not globally on `normalized_name`.
- If not taken on the selected game's completed leaderboard: start playing.
- If taken: show **exactly this type of decision**, not a generic error:
  - Heading: `TAG ALREADY ON THIS BOARD`
  - Body: `"Nova" already has a score in REACTION.EXE. Is that you?`
  - Buttons: `YES, THAT'S ME` (continue with same existing leaderboard identity) and `NO, CHANGE TAG` (return to editable field, keep focus).
- Do **not** make a user prove ownership in the MVP: it is a casual stand competition. Clearly understand that tapping YES is based on trust, not secure identity verification. Do not falsely claim it authenticates ownership. An optional PIN can be a future version, **not part of MVP**.
- Store no public leaderboard entry for an abandoned session that has never completed a game. An abandoned session must not make a nickname permanently appear taken.
- If two simultaneous players finish using a newly free identical nickname, handle the unique-index collision gracefully rather than losing the second score: offer `Choose a different tag to save this result` with the saved pending result retriable.

## Finishing gameplay

1. Stop gameplay input and calculate/validate result.
2. Submit once to backend with an attempt/session ID (idempotent: retries must not duplicate attempts).
3. If saving succeeds, show brief large result feedback, e.g. `780 POINTS`, `NEW PERSONAL BEST`, `RANK #04`.
4. Provide `BACK TO ARCADE` button. Also automatically return to Home after about **4 seconds**; keep the last played game's leaderboard selected.
5. Display a compact non-blocking result summary on Home so players still see their score.
6. If network saving fails, **do not falsely show that score as saved**; show `COULD NOT SAVE — RETRY` and retain the pending result locally long enough to retry.
7. A game may be quit early using an accessible `QUIT` control with confirmation; quitting does not submit a score.

---

# 3. Games and precise scoring

**All games have their own leaderboards and individual score out of 1,000.** The shared 0–1,000 range is only visual consistency; scores are never added together, compared across games, or displayed as a global total. Servers should recompute scores from attempt data where practical, rather than accepting an arbitrary `score` supplied by the browser.

## 3.1 REACTION.EXE — reflex test

**Fantasy:** Wait for the cue, click/tap the screen instantly.  
**Length:** 5 trials, typically 20–35 seconds.  
**Gameplay:**

1. Show `WAIT FOR BLUE...` with a central responsive clickable area in red/dark warning state.
2. After a randomized wait between **1.5 and 4 seconds**, switch to vivid electric blue/white and show `NOW!`.
3. On pointer/keyboard input, record reaction time in milliseconds using a high-resolution timer (`performance.now()` in browser), show concise feedback, then proceed.
4. An early click before the cue is a **false start**: consume that trial and award **0 points** for it. Make the mistake obvious (`TOO EARLY!`).
5. If no valid tap within **1.5 seconds after cue**, consume the trial with **0 points**.
6. Repeat until all 5 trials are complete. Show progress `03 / 05`.

**Exact scoring:**

```ts
// Per trial, valid input at reactionMs >= 100 and <= 1500.
// False start, timeout, or implausibly fast (<100 ms) -> 0.
trialPoints = clamp(Math.round(((650 - reactionMs) / 500) * 200), 0, 200);
finalScore = sum(fiveTrialPoints);  // Integer 0–1000
```

**Tie-break:** Lower mean milliseconds across valid trials; if tied, earlier best achieved timestamp. A run with no valid trials gets an appropriately worst tie-break value.

**UX:** Don't use camera or microphone. Support mouse, touch, and `SPACE`/`ENTER`. Prevent double input and accidental text selection. Keep cue color contrast unmistakable. Do not play an anticipatory animation that reveals when the cue will appear.

## 3.2 MEMORY.STACK — sequence memory

**Fantasy:** Remember increasingly long sequences on a 3×3 panel.  
**Length:** Up to 6 rounds, target under ~90 seconds.  
**Gameplay:**

1. Present **nine large tiles** in a clean 3×3 arrangement.
2. The first round lights **2 tiles** in sequence. The player repeats those positions.
3. Each completed round adds **one tile** to the end of the same sequence. Sequence lengths: **2, 3, 4, 5, 6, 7**.
4. Show sequence with readable timing (for example, ~500ms flash / ~180ms gap; tweak for game feel). Input is disabled while sequence plays.
5. A wrong tile ends the run; award points for completed rounds only. A run also ends after clearing round 6 or hitting a generous overall 90-second ceiling.
6. On success of each round, show brief punchy transition: `SYNCED`, `LEVEL 04`, etc.

**Exact scoring:**

| Completed round | Points awarded for that round |
|---|---:|
| 1 — length 2 | 100 |
| 2 — length 3 | 120 |
| 3 — length 4 | 140 |
| 4 — length 5 | 160 |
| 5 — length 6 | 220 |
| 6 — length 7 | 260 |
| **Perfect run** | **1000** |

`finalScore` = total points for completed rounds. Do not award points for partial round progress.

**Tie-break:** Shorter elapsed time through the **last successfully completed round** for equal scores (not time spent after that round before making a mistake); timestamp thereafter. Record successful round events and player tile inputs to check sequence correctness before saving.

**UX:** Give each tile a clear outline and geometric marker as well as color (not just indistinguishable flashes). Support clicking/tapping tiles or number keys `1–9`. Keep spacing sufficient on phones.

## 3.3 AIM//TRAINER — accuracy + speed

**Fantasy:** 20 targets. One countdown. How fast are you?  
**Length:** Max **30 seconds**.  
**Gameplay:**

1. Present a bounded, responsive playfield with countdown `00:30` and counter `00 / 20`.
2. Exactly **one target** is active at a time; each hit immediately spawns the next target at a new random location.
3. Keep target entirely inside playfield and away from HUD; don't spawn practically on top of the previous target (set a sensible minimum separation as a fraction of the playfield diagonal).
4. Use generously clickable targets (at least ~48 CSS px on mobile). Difficulty should come from speed and movement, not invisible hitboxes.
5. Complete as soon as 20 hits land, or when 30 seconds are up. Clicking empty space has no point penalty, but costs time.

**Exact scoring:**

```ts
base = successfulHits * 40; // Max 800, 0–20 hits
bonus = successfulHits === 20
  ? Math.round(200 * Math.max(0, (30_000 - elapsedMs) / 30_000))
  : 0;
finalScore = base + bonus; // Integer 0–1000
```

**Tie-break:** If all 20 hit, fastest completion elapsed milliseconds. If incomplete, fewer misses and then earlier best timestamp. Ignore clicks after time expires.

**UX:** Mouse and touch. Prevent the mobile browser from scrolling/zooming during active play. Use reliable pointer events and responsive hit areas. At the stand, identical hardware is recommended for especially fair rankings; mouse and touch reaction patterns are not identical.

## 3.4 GEEK.CHECK — tech knowledge quiz

**Fantasy:** Five short questions, fast answers, geek pride.  
**Length:** 5 questions × **10 seconds** each = max ~50 seconds plus transitions.  
**Topics:** Linux/terminal, Python, cybersecurity, AI/data, and development/web.

**Gameplay:**

1. Every run gives **5 four-option questions**, one from each topic.
2. Use a curated bank of **at least 30 accurate questions** (starter bank in Section 9). Do not use a live AI API or external trivia API during gameplay.
3. Ensure comparable difficulty across runs: **2 easy, 2 medium, 1 hard question** each time; randomly assign the five difficulty slots across the five categories, then choose a matching question from each category.
4. Randomize question order and answer option order; keep the correct-answer mapping accurate. Prefer not to repeat the last selection for the same nickname when there are unused alternatives (nice-to-have).
5. Show question `02/05`, visible 10-second bar, category, and four large answer buttons.
6. Click an answer to lock it in. Show immediate `CORRECT` / `NOPE` feedback with the correct option, then move on after a short delay. No backtracking.
7. If 10 seconds elapse with no answer, mark it incorrect and move on.
8. Keep all correct answers **server-side**; the public question API should send question ID, prompt, options, category, and time limit, **not** `correctAnswer`.

**Exact scoring:**

```ts
// For each question answered correctly within 10s:
questionPoints = 100 + Math.round(100 * (remainingMs / 10_000));
// Wrong, skipped, or expired answer: 0.
finalScore = sum(fiveQuestionPoints); // Integer 0–1000
```

**Tie-break:** Lower total answer time for valid submitted answers; timestamp thereafter. Server grades correctness and validates timing bounds.

**Question writing quality:** Interesting, approachable for mixed skill levels, and technically unambiguous. Slight geek humor in UI copy is welcome, but no confusing trick answers. Keep English copy short and clear. Never put a correct-answer key in the client JavaScript bundle.

---

# 4. Leaderboard, persistence, and identity logic

## Separate leaderboards

Game IDs are exactly:

```ts
type GameId = 'reaction' | 'memory' | 'aim' | 'trivia';
```

All queries, name checks, upserts, and ranked result retrieval MUST be scoped to `game_id`. **Never perform a global nickname existence check.**

For each game, display a sorted TOP 10 leaderboard by:

1. `best_score` DESC,
2. `best_tiebreak_ms` ASC when meaningful,
3. `best_achieved_at` ASC (earlier gets preference),
4. `normalized_name` ASC for deterministic order.

The player's best is the only public row per normalized nickname **in that game**. On replay:

- Always record the valid completed attempt in attempts history (admin can inspect totals).
- Increment the player/game attempt count.
- Replace their leaderboard `best_score` and tie-break only if the new attempt is **better** (higher score, or same score with better tie-break).
- If they score worse, their leaderboard best stays unchanged.
- Two players can use the same normalized nickname in **different games** without collision.
- If someone exits without completing a game, do not populate the leaderboard.

## Suggested production database (PostgreSQL)

Use **Neon PostgreSQL provisioned via Vercel Marketplace**. Access it exclusively from Next.js server-side Route Handlers/server modules through Drizzle ORM. The production schema must be represented in typed `src/db/schema.ts` and generated, version-controlled Drizzle migrations. The SQL below is a **logical reference**, not an instruction to paste SQL manually into a dashboard. Maintain the essential uniqueness, foreign keys, ranking indexes, and transactional invariants:

```sql
CREATE TABLE leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL CHECK (game_id IN ('reaction','memory','aim','trivia')),
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  best_score INTEGER NOT NULL CHECK (best_score BETWEEN 0 AND 1000),
  best_tiebreak_ms INTEGER NOT NULL DEFAULT 2147483647,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  best_achieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT game_name_unique UNIQUE (game_id, normalized_name)
);

CREATE TABLE game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL CHECK (game_id IN ('reaction','memory','aim','trivia')),
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  session_token_hash TEXT NOT NULL,
  session_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  state TEXT NOT NULL CHECK (state IN ('started','finished','abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ
);

CREATE TABLE attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES game_sessions(id),
  game_id TEXT NOT NULL CHECK (game_id IN ('reaction','memory','aim','trivia')),
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 1000),
  tiebreak_ms INTEGER NOT NULL,
  attempt_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX leaderboard_game_rank_idx
  ON leaderboard_entries (game_id, best_score DESC, best_tiebreak_ms ASC);
CREATE INDEX attempts_game_name_idx
  ON attempts (game_id, normalized_name, completed_at DESC);
```

Use a **single atomic PostgreSQL transaction** for session completion + unique attempt insert + conditional personal-best leaderboard upsert. Prefer Drizzle with the Neon serverless driver supporting transactions, or a proven single-statement PostgreSQL CTE/UPSERT if simpler; do not simulate transactions with independent requests. Never use process memory for live leaderboards, and never persist live data to the Vercel filesystem. Store only data needed for ranking and moderation; minimize personal data. A unique index on `(game_id, normalized_name)` must exist in the actual migrated database. Increment the attempt count even when the best does not improve, without ever letting the best regress. Run concurrent-session tests.

## Endpoints / backend behaviors

Implement these server endpoints or functionally equivalent routes:

| API | Purpose |
|---|---|
| `GET /api/leaderboard?game=reaction` | Top 10 for one game, with rank and necessary public fields; never leak session metadata. |
| `GET /api/nickname/check?game=aim&name=Nova` | Whether a **completed leaderboard** entry has this nickname in this game. Use `encodeURIComponent` on the client. |
| `POST /api/game/start` | Validate nickname and selected game, honor `confirmExisting`, create expiring session; return session ID/token and safe game configuration. |
| `POST /api/game/answer` | For trivia, submit/grade one answer safely and prevent duplicates (or securely grade at session end if simpler). |
| `POST /api/game/finish` | Validate session, one-time submission, grade/recompute score from events, upsert best, return score, best, rank, and PB indicator. |
| `GET /api/health` | Basic health check without disclosing secrets. |
| `/admin` + secured admin API | Moderate leaderboards and reset a game. |

Notes:

- API must check both **game ID and normalized nickname** as the lookup key.
- Session token should be unguessable, stored only as a hash server-side, time-limited (e.g. 5 minutes), and cannot submit twice. Idempotent repeat requests may return the stored result.
- Validate score event shapes, numbers, game duration, and plausible timing; do not accept a direct `score: 9999` as truth.
- There is no perfectly cheat-proof browser reaction/aim/memory test; implement sensible server verification and document this limitation, rather than pretending browser timings are tamper-proof.
- Add reasonable bot/rate protection without breaking many students sharing school Wi-Fi. Sanitize/escape nicknames in rendering. Never build unsafe HTML from player input.
- When the game is finished, explicitly mark its session `finished` and make replay generate a **new** session.
- Production must survive app restarts and serve the same leaderboard across phones/computers.
- API endpoints are **Next.js App Router Route Handlers** under `src/app/api/.../route.ts` and run on Vercel as part of the same application. Prefer `export const runtime = 'nodejs'` for database/admin endpoints.
- Guard inputs with Zod or equivalent on the server; never trust data coming from the browser. Use prepared/parameterized ORM queries.
- Prevent cache-related stale ranks: leaderboard requests and post-save reads must be dynamic (`no-store` / dynamic rendering or explicit invalidation).

---

# 5. Visual direction — N7Geeks × Cyberpunk × Japanese street design

The game should look like a **premium designed arcade microsite**, not a generic dashboard, hacker terminal, or default component library template.

## Creative brief

- Main inspiration: **Cyberpunk: Edgerunners** energy + **Japanese streetwear / poster graphic design** + **tech brutalism**.
- Translate the inspiration into an **original** brand design. Do not copy copyrighted characters, official anime logos, or proprietary artwork.
- Most important identity: **N7Geeks blue + white**.
- Supporting elements: deep midnight/navy, electric cyan, **small** hits of fluorescent yellow, magenta/pink, and alert red. Accents must NOT overpower the blue/white brand.
- Bold anime-poster graphic composition: asymmetry, oversized typography, skewed bars, clipping corners, stacked labels, caution stripes, panel numbers, thick outlines, small halftone areas, graphic sticker-like shapes, sparing manga speed lines.
- A playful **bouncy sunglasses motif** is part of N7Geeks' identity; include as a tasteful loading/transition detail or small easter egg. Do not let it distract during timed gameplay.
- A cohesive visual language across all four games, with distinct game-specific icons/animations.
- **Avoid:** black-and-green Matrix rain, stock hacker silhouettes, random binary streams, generic gradients, excessive glow/blur, crowded unreadable dashboards, fake Japanese text, or gratuitous 3D effects.

## Suggested theme tokens (adjustable if exact logo colors are supplied)

| Role | Color | Hex |
|---|---|---|
| Core brand | Electric N7 blue | `#188CFF` |
| Bright primary | White | `#FFFFFF` |
| Canvas / text on light panels | Deep ink/navy | `#091426` |
| Secondary dark | Midnight blue | `#101F36` |
| Secondary accent | Cyan | `#56E5FF` |
| Limited punch | Signal yellow | `#F8E84D` |
| Limited punch | Hot pink | `#FF4DA5` |
| Incorrect / danger | Alert red | `#FF4564` |
| Off-white surface | Paper white | `#F1F6FF` |

**Hierarchy:** white, blue, and deep navy dominate; yellow/pink/red are accents. Use CSS variables for all colors.

## Typography and layout

- Strong heavy display font with character; e.g. **Space Grotesk** + **Archivo Black** or similarly licensed fonts from a standard hosted package. Use an expressive oversized condensed face for headlines and crisp readable body type.
- Some decorative **accurate** Japanese labels can accompany English headings, such as `反応` (reaction), `記憶` (memory), `照準` (aim), `知識` (knowledge). They must never replace the readable English game names.
- Main desktop layout: bold top masthead; left/central set of four game tiles; right-side or lower leaderboard module; mobile layout stacks cleanly.
- Use sharp corners or clipped polygon corners, heavy strokes, large numerals, and a few intentional overlaps. Emphasize comfortable hit targets.
- Make scores very legible: large tabular digits, high contrast, fast score pop animations.
- Cards should be different enough to recognize instantly without deviating from the overall brand system.
- Design **both** the light/white graphic panels and dark/navy gameplay screens intentionally. Avoid a homogeneous wall of dark neon boxes.
- Use CSS/SVG/canvas for decorative motifs and game pieces to keep performance high and edges sharp. If user adds the official N7Geeks logo later, use it unchanged; until then use a tasteful editable `N7GEEKS` typographic placeholder. **Never invent a replacement official logo.**

## Motion, feel, and sound

- High-quality microinteractions: cards snapping/tilting subtly, crisp screen wipes, score counting, restrained glitch transitions, target hit bursts, combo-like feedback, lights that pulse with purpose.
- Prefer 60fps CSS/transform animations with minimal heavy effects.
- **No noisy animations during reflex cue timing**, trivia readability, or memory tile repetition.
- Audio optional and **muted by default** (it will run in a noisy university stand). Provide a visible sound toggle. No copyrighted music.
- `prefers-reduced-motion` must disable aggressive movement, flashing, and shaking while keeping game cues usable.
- Mobile-first interaction quality: touch, keyboard focus, large buttons, no hover-only instructions, legible scoreboards. Maintain strong contrast.

## Example short UI copy / personality

- `CHOOSE YOUR CHALLENGE`
- `ONE GAME. ONE BOARD. ZERO EXCUSES.`
- `ENTER YOUR TAG`
- `YOUR REFLEXES HAVE BEEN SUMMONED`
- `MEMORY BUFFER: LOADING...`
- `LOCK IN. HIT 20.`
- `NERD CHECK // 05 QUESTIONS`
- `NEW PERSONAL BEST!`
- `YOU MADE THE BOARD.`
- `NOT BAD. RUN IT BACK.`

The tone is playful, competitive, witty, and not overly childish. Avoid excessive generic hacker jargon.

---

# 6. Admin and stand operations

A simple protected `/admin` route is a **required MVP utility**, because booth organizers need to manage abusive names and test scores.

- Protect admin access on the server using an `ADMIN_PASSWORD` environment variable and a signed HTTP-only session cookie. Never embed the admin password in frontend JS.
- Admin can select a game and see its full leaderboard, not only TOP 10.
- Admin can delete a nickname's entry in a specific game (confirmation required; must not affect that nickname in other games).
- Admin can reset the entire leaderboard for **one chosen game** after a strong confirmation step, useful before public launch or between event days.
- Admin can export all four leaderboards to CSV files, each with game, display name, best score, rank, attempts, and achieved time.
- Do not expose management actions to public visitors. Use safe HTTP verbs, CSRF-safe patterns, and server-side authorization.
- Show a small indicator for `DEMO MODE` when mock data is being used, and require a production DB for the live stand.

---

# 7. Mandatory full-stack Next.js architecture and Vercel one-project deployment

This section is the **implementation contract**. It replaces all earlier guidance suggesting a separate backend service or manually managed Supabase setup.

## 7.1 Fixed production stack

| Concern | Required implementation | Notes |
|---|---|---|
| Full-stack framework | **Next.js App Router + TypeScript** | Use a current stable, Vercel-supported Next.js release; use `src/` directory. |
| Frontend | React client components where interaction is needed | Game timers/inputs remain on client; Home may use server components as appropriate. |
| UI | Tailwind CSS + custom CSS/SVG + accessible components | Avoid generic out-of-the-box template styling. |
| Backend | **Next.js Route Handlers** within this app | `/api/...` lives in this same repository and deploys with Next.js. |
| Database | **Neon PostgreSQL**, connected through the **Vercel Marketplace Neon integration** | Real cloud database shared across all devices and deployments. |
| ORM and migrations | **Drizzle ORM + Drizzle Kit** | Version-controlled, repeatable migrations; schema and types in repo. |
| Data validation | Zod or a comparable schema validator | Server validation for every write and query parameter. |
| Testing | Vitest + Testing Library; Playwright smoke tests strongly preferred | Verify actual game flows, scoring, and Vercel-safe APIs. |
| Hosting | **A single Vercel project** created from one GitHub repository | No additional Node server, Redis requirement, or separate hosting. |
| Authentication | Players: none; organizers: server-protected `/admin` | Never send admin secrets or DB connection info to browsers. |

**Forbidden substitutes:** Express server on another host, a separate NestJS service, Firebase-only client-side persistence, `localStorage` as the live leaderboard, JSON files as the live database, or manual deployment of a backend VM.

### Why this is practically one-click

Vercel can import/deploy a Next.js Git repository and the Neon Marketplace integration can provision a PostgreSQL database while injecting connection credentials. The app should require **no manual copy/paste of SQL** and **no separately deployed API**. A real first deployment still requires authorizing the Git repository, installing/confirming Neon, and securely supplying organizer credentials; document these honestly rather than claiming magic zero-setup infrastructure.

## 7.2 Suggested single-repository directory structure

Implement a clear structure at least equivalent to:

```text
n7geeks-arcade/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                       # Home, four games, selected board
│   │   ├── play/[gameId]/page.tsx         # Real client-side gameplay
│   │   ├── admin/page.tsx                 # Protected management UI
│   │   └── api/
│   │       ├── leaderboard/route.ts
│   │       ├── nickname/check/route.ts
│   │       ├── game/start/route.ts
│   │       ├── game/answer/route.ts       # Trivia grading; optional if equivalent
│   │       ├── game/finish/route.ts
│   │       ├── health/route.ts
│   │       └── admin/...
│   ├── components/
│   │   ├── arcade/                        # Cards, masthead, leaderboard, modal
│   │   ├── games/                         # Reaction, Memory, Aim, Trivia
│   │   └── ui/                            # Buttons, dialogs, etc.
│   ├── db/
│   │   ├── index.ts                       # Server-only Neon/Drizzle DB connector
│   │   ├── schema.ts                      # Single source of schema truth
│   │   └── queries.ts
│   ├── lib/
│   │   ├── games/                         # Shared game definitions and scoring
│   │   ├── trivia/questions.server.ts     # Secret answer keys stay server-side
│   │   ├── nickname.ts                    # NFKC/trim/casefold + validation
│   │   ├── leaderboard.ts                 # Atomic scores and rank computation
│   │   ├── sessions.ts                    # Expiring, idempotent sessions
│   │   ├── admin-auth.ts                   # Admin-only session & cookie logic
│   │   └── env.ts                          # Server-only environment validation
│   └── styles/...
├── drizzle/                               # Generated SQL migrations (committed)
├── scripts/
│   └── prepare-build.mjs                  # Safe automatic migration gate
├── tests/
├── public/                                # Assets, official N7Geeks logo when supplied
├── drizzle.config.ts
├── .env.example
├── README.md
├── package.json
└── ...
```

The exact folders may vary. The invariant is that **a single Next.js repository builds both the arcade UI and all server endpoints**. Do not add a standalone `/backend` application or a second deployment.

## 7.3 Database correctness and operations

- Connect with Vercel Marketplace Neon; expect a server-only `DATABASE_URL` connection string after provisioning (verify the actual provided key and map it explicitly if needed).
- Use a Neon-compatible Drizzle driver from `@neondatabase/serverless` with a reliable transaction strategy; make the choice explicit in README. If choosing the HTTP driver, use one-statement atomic SQL for writes needing atomicity or verify the driver's transaction support. Interactive transactions must actually work in Vercel's Node runtime.
- The Drizzle schema represents `leaderboard_entries`, `game_sessions`, `attempts` as described in Section 4 and any extra quiz/session data required for server validation.
- Keep a unique DB constraint on `(game_id, normalized_name)`; use unique session/attempt IDs, appropriate foreign keys and indexes.
- Score submission must be **idempotent** even after a browser retry or transient network failure.
- Use server-generated sessions, random unguessable session tokens, token hashes in storage, expiration, and server-controlled quiz answer keys.
- Use conditional best-score update logic that cannot regress the best score and tiebreak under simultaneous writes.
- No database access from browser components; **NEVER** prefix `DATABASE_URL` or private secrets with `NEXT_PUBLIC_`.
- Do not use Vercel's ephemeral filesystem for saving scores. `localStorage` can keep a pending unsaved result temporarily for retry; it is not a source of official ranks.
- The database must persist across redeploys and be shared across multiple mobile devices and stand computers.
- Define careful admin reset behaviors: select exactly one game; optionally clear its attempts/sessions if explicitly confirmed; never affect the other three boards.

## 7.4 Automatic migrations for a low-friction Vercel deploy

Codex MUST include migrations **inside the repository** and arrange for **new production deployments to apply outstanding, non-destructive migrations automatically**, so organizers never have to open the Neon SQL Editor or manually run SQL before the first use.

Preferred build setup:

```jsonc
{
  "scripts": {
    "dev": "next dev",
    "build": "node scripts/prepare-build.mjs && next build",
    "start": "next start",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint ."
  }
}
```

`prepare-build.mjs` must:

1. Detect environment safely; permit **local** `DEMO_MODE=true` builds without DB.
2. Fail clearly on `VERCEL_ENV=production` when `DATABASE_URL`, `ADMIN_PASSWORD`, or `SESSION_SIGNING_SECRET` are missing/invalid. **Never silently switch the production app into demo mode.**
3. For a configured real database, apply the checked-in Drizzle migrations (idempotently) **before** building/serving the first production release.
4. Use a migration lock / concurrency-safe process, or otherwise ensure simultaneous builds cannot corrupt migration state. Don't seed or delete public scores on redeploy.
5. Ensure preview deployments use their **own Neon branch** if they execute schema migrations or destructive tests. Never reset/alter live leaderboards from a preview deployment. If previews aren't configured, document that limitation and keep previews from mutating production schema.
6. Fail the build with a useful message if migrations fail; do not serve an apparently successful but broken arcade.

The code block above illustrates scripts, not an instruction to paste a literal `jsonc` file as `package.json`; write valid JSON. If Codex selects a more reliable Vercel/Neon migration strategy, document it and preserve the **zero manual SQL on deployment** requirement.

## 7.5 Environment configuration

Commit `.env.example` (no secrets) with exactly the information needed:

```dotenv
# For local development only; set false/omit on live Vercel Production.
DEMO_MODE=true

# Injected automatically by the Neon marketplace connection on Vercel.
# For local production-like testing, fill from `vercel env pull` or Neon.
DATABASE_URL=

# Required in Production; enter as Vercel Environment Variables.
ADMIN_PASSWORD=
SESSION_SIGNING_SECRET=

# Optional; derive the public host from Vercel deployment metadata when omitted.
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Rules:

- `DATABASE_URL`, `ADMIN_PASSWORD`, and `SESSION_SIGNING_SECRET` are **server-only**; never exposed to the client, public logs, or Git.
- Set a strong `ADMIN_PASSWORD`, a random 32+-byte `SESSION_SIGNING_SECRET`, and verify admin cookies are secure, HTTP-only, SameSite, appropriately expiring, and signed.
- Avoid storing plain passwords in cookies or JavaScript. Compare admin credentials safely; rotate secrets if leaked.
- `NEXT_PUBLIC_SITE_URL` is optional: for QR/share/metadata prefer Vercel's deployment URL/environment or a validated configured canonical URL; do not hardcode `localhost` into production links.
- Production must error safely when Neon isn't linked, not run a fake local leaderboard.
- **No mandatory Supabase account**, service-role key, external trivia API, or external auth provider.

## 7.6 Local demo and real local database testing

Two explicit run modes:

**Local demo (fastest):**

```bash
npm install
cp .env.example .env.local
# Keep DEMO_MODE=true
npm run dev
```

- All four games, nickname prompts, result overlays, and independent leaderboards actually work in demo mode.
- Implement a local development repository/adapter behind the **same internal APIs** and interfaces used by the production data store. Demo memory can reset after a restart; visibly label `DEMO MODE — SCORES NOT SHARED`.
- Demo mode must not be enabled silently in Vercel Production.

**Real local DB mode:**

```bash
# After connecting Neon to the Vercel project:
vercel link
vercel env pull .env.local
# Ensure DEMO_MODE=false in the local env if applicable.
npm run db:migrate
npm run dev
```

- Pulling env vars may overwrite the local file; document safe merging of necessary local flags.
- Running against a real Neon database affects real data; recommend a **development Neon branch** rather than production for local testing.
- Before events, organizers should reset test leaderboards from `/admin` after confirming live mode and the correct database.

## 7.7 Vercel deployment flow (required in README)

Design the repository so this is the practical publishing process:

1. Build and verify the repo with Codex; commit and push the complete app to **GitHub**. No manual uploads of separate frontend/backend builds.
2. Open **Vercel → Add New Project → Import the GitHub repository**, or click the repo's generated **Deploy with Vercel** button.
3. Select the Next.js framework; root directory is repository root; standard build should be auto-detected.
4. Add **Neon Postgres through Vercel Marketplace** to this project (or have it provisioned by a properly configured deploy template); choose a region close to stand attendees and approve the plan. Vercel injects the database credentials.
5. In Vercel environment settings/deploy flow, provide `ADMIN_PASSWORD` and `SESSION_SIGNING_SECRET`; never use example values. Ensure `DEMO_MODE` is false/unset in Production.
6. Deploy / redeploy after integrating Neon and secrets if the first build preceded the database connection. The migration preparation should create tables automatically on the first successful production build.
7. Open the deployed URL on two devices, play distinct games using the same tag, confirm each leaderboard persists independently, verify the nickname confirmation flow, and test `/admin`.
8. Optionally connect a custom domain and make the stand's QR code from the **actual verified production URL**.

**One-click deploy button:** After the user publishes the actual GitHub repository, generate a README link with the *real* URL, using Vercel's deploy button convention:

```text
https://vercel.com/new/clone?repository-url=<URL-ENCODED-ACTUAL-GITHUB-REPOSITORY-URL>
```

Do NOT invent a GitHub URL or imply a Deploy button already works before a repo exists. If supported by current Vercel syntax, configure the deploy flow to request required secrets and optionally the Neon integration; obtain verified integration identifiers before putting them in URLs. A Deploy button begins Vercel setup; it cannot securely bypass account consent, Neon confirmation, or secret entry.

## 7.8 Operational and Vercel serverless constraints

- No WebSocket server, background worker, interval in Node process, or always-on custom backend required.
- Do not rely on in-memory production state across Vercel function invocations; share all competition records through Neon.
- Game timers are client-side for responsiveness, but server endpoints validate/grade submitted game events and server-side question response windows where possible. Document that some client timing cannot be made cheat-proof.
- Use database/server UTC timestamps; browser may display local time, but rankings must remain deterministic.
- Serve fresh scoreboards with `Cache-Control: no-store` or equivalent and refresh in the Home UI at reasonable intervals; no expensive real-time subscription necessary.
- Handle Neon cold starts and network outages with loading/retry/timeout states. Do not claim that unsaved results are saved.
- Use restrictive admin route authorization on **every** admin mutation, not just a visual UI guard. Admin route must be protected in production.
- Keep public API responses lean. Do not expose quiz correct-answer IDs before answers are closed or private session tokens from another player.
- Keep heavy visual effects and giant image assets out of fast, timed games. Make asset downloads resilient on phones/weak Wi-Fi.

## 7.9 Required project deliverables

- All Next.js source files, actual functioning four mini-games, scoring and backend routes, nicknames, rankings, UX and design system.
- Drizzle schema, committed SQL migrations, DB seed/setup **without pasting SQL in a cloud dashboard**, and automatic production migration strategy.
- Typed 30-question **server-only** trivia bank from Section 9.
- Protected `/admin` tools to moderate, delete, export, and selectively reset boards.
- `.env.example`, `README.md` with local demo and Neon/Vercel setup, plus a working **Deploy with Vercel** README link after repository URL exists.
- An organizer setup checklist: Vercel env check, database live health check, real-vs-demo badge, resetting test scores, opening the public URL on laptop/phone, printing a QR code for the verified URL.
- Tests for independent names, collision handling, best-score updates, atomic/idempotent finishing, reset isolation, trivia answer hiding, four scoring algorithms, and gameplay controls.
- Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`; fix any failures; report precisely what was and wasn't verified.

## 7.10 Responsive and event constraints

- Desktop: 1366×768 and 1920×1080 tested; no hidden primary actions.
- Mobile: 375×812 (and wider) tested; no horizontal overflow and comfortable targets.
- Support keyboard navigation; game shortcuts are shown in the HUD.
- Handle tab visibility changes fairly: do not pause a timed challenge silently when the tab is hidden. Use monotonic timing and document the chosen behavior for interrupted games.
- No camera, microphone, geolocation, or mandatory user email/login.
- Keep scripts/assets small; all gameplay should be useful on moderate cellular/Wi-Fi connections.
- Shared-laptop booth UX: after 4-second result screen, return to Home and show the relevant board. No retained personal sessions/sign-in state for players.

### Reference documentation (for Codex to consult if tooling has changed)

- Vercel Marketplace Neon: https://vercel.com/marketplace/neon
- Vercel storage integrations and credential injection: https://vercel.com/docs/marketplace-storage
- Vercel Deploy button: https://vercel.com/docs/deploy-button
- Vercel's Next.js + Neon template: https://vercel.com/templates/next.js/vercel-with-neon-postgres
- Drizzle Neon drivers / transactions: https://orm.drizzle.team/docs/connect-neon

---

# 8. Example functional acceptance tests (must pass)

1. **Separate nickname namespace:** `Nova` plays REACTION.EXE and appears in Reaction leaderboard. `Nova` then chooses MEMORY.STACK. Entering `Nova` **does not** trigger the already-existing prompt for Memory.
2. **Same-game existing nickname:** `Nova` tries Reaction again. The app says that tag exists **on Reaction** and asks `YES, THAT'S ME` or `NO, CHANGE TAG`.
3. **Yes path:** Clicking `YES, THAT'S ME` starts Reaction with the same leaderboard identity. After finish, their best may improve, with **one** leaderboard entry.
4. **No path:** Clicking `NO, CHANGE TAG` returns focus to editable nickname; they can select a different name.
5. **Normalization:** `nova`, ` NOVA `, and `Nova` match the same Reaction leaderboard entry; they still do **not** conflict with Memory's `Nova` entry.
6. **Scores per game:** A player can be rank #1 in Aim and absent from Trivia. No overall ranks or sum of game scores appear anywhere.
7. **Best-score behavior:** Reaction `Nova` first gets 410; replay gets 360 -> board remains 410; replay gets 540 -> board becomes 540. Attempt count increases each time.
8. **Score boundaries:** All games produce integers between 0 and 1000. React false starts score 0 for those trials. Memory wrong tile ends the run. Aim times out at 30s. Trivia times out per question at 10s.
9. **Post-game redirect:** Completing any game shows short results and then returns Home, displaying all four game cards and the specific game's current board. A rank/score summary remains visible.
10. **Persistence:** On production Vercel + Neon mode, run on Phone A, refresh Phone B, and see the same ranking. Restarting server or redeploying must not erase it.
11. **Abandoned name:** Starting then quitting a game without completing it does not put the nickname on the public board or permanently reserve it.
12. **Safe submission:** Submitting the same finished session twice does not add two attempts; sending a forged arbitrary `score` does not overwrite a legitimate result.
13. **Admin separation:** Deleting `Nova` from Reaction leaves `Nova` in Memory intact. Resetting Trivia does not wipe other leaderboards.
14. **Device usability:** All four games work with mouse/touch; Reaction supports keyboard, Memory supports numeric keys, Trivia supports answer buttons/keys.
15. **Loading/errors:** Missing database credentials in production produce a clear configuration error, not a fabricated persistent leaderboard. A failed submission keeps retry available.
16. **Access & visuals:** Reduced-motion mode works; contrast is readable; no external copyrighted anime artwork; exact N7Geeks logo can be swapped in later without redesign.
17. **Single Vercel project:** Frontend and `/api` routes work under the *same* Vercel URL, with no separately deployed backend.
18. **Migrations:** A new Neon database is initialized by repo-committed migration logic on production build, with no manual SQL-editor step; redeploy does not reset scores.
19. **Serverless persistence:** Multiple browsers see identical ranks after deploy, cold start, and refresh; the code does not read/write a local server data file.
20. **Production fail-safe:** Production without `DATABASE_URL` or required admin secrets fails setup clearly rather than silently falling into demo mode.
21. **Admin restrictions:** Every admin write is checked server-side; credentials never appear in built browser JS.
22. **Demo separation:** `DEMO_MODE=true` works locally; demo scores are clearly nonpersistent/nonshared and cannot be accidentally presented as production results.
23. **Deployment README:** A newcomer can follow the documented single-repo GitHub → Vercel → Neon integration → secrets → deploy workflow without provisioning a second backend or running SQL manually.

---

# 9. Starter question bank (30 concrete questions)

Codex: implement the following **30 questions** as typed data on the server. Every question needs `id`, `category`, `difficulty`, `prompt`, exactly four `options`, and `correctOptionId`. Do not expose correctOptionId publicly. Option labels A–D below are for specification only; randomize displayed option order each session. Keep code strings precisely formatted. These are starter questions; organize content so an organizer can easily edit/add items later.

**Categories:** `linux`, `python`, `cybersecurity`, `data-ai`, `dev-web`. Each category contains 2 easy, 2 medium, and 2 hard questions, enabling the desired quiz selection algorithm.

### Linux / terminal

| ID / level | Question | A | B | C | D | Correct |
|---|---|---|---|---|---|---|
| L01 / Easy | Which command lists files in the current directory? | `ls` | `cd` | `pwd` | `echo` | A |
| L02 / Easy | Which character usually represents your home directory in a Linux shell? | `#` | `~` | `*` | `?` | B |
| L03 / Medium | What does `pwd` print? | Process list | Current working directory | User password | File permissions | B |
| L04 / Medium | Which tool commonly searches text for a matching pattern? | `mkdir` | `mv` | `grep` | `touch` | C |
| L05 / Hard | In `chmod 755 file`, what can group members do? | Read and execute | Read and write | Execute and write | Read, write, and execute | A |
| L06 / Hard | What is `/dev/null` commonly used for? | Keeping user passwords | Discarding unwanted output | Installing packages | Backing up the home folder | B |

### Python

| ID / level | Question | A | B | C | D | Correct |
|---|---|---|---|---|---|---|
| P01 / Easy | Which syntax creates a Python list? | `{1, 2}` | `(1, 2)` | `[1, 2]` | `<1, 2>` | C |
| P02 / Easy | What is `len([2, 4, 6])`? | 2 | 3 | 6 | 12 | B |
| P03 / Medium | What numbers does `list(range(3))` contain? | `1,2,3` | `0,1,2,3` | `0,1,2` | `3` | C |
| P04 / Medium | What does `'hi'.upper()` return? | `hi` | `Hi` | `HI` | `ERROR` | C |
| P05 / Hard | What is the main risk of using `items=[]` as a default function argument? | It is immutable | The same list may be reused across calls | Python immediately crashes | Lists cannot be arguments | B |
| P06 / Hard | What is `set([1, 1, 2, 2])` conceptually? | A collection containing unique 1 and 2 | A four-element ordered list | A dict with two keys | Syntax error | A |

### Cybersecurity

| ID / level | Question | A | B | C | D | Correct |
|---|---|---|---|---|---|---|
| C01 / Easy | HTTPS normally protects web traffic using which technology? | DNS | TLS | FTP | SSH keys only | B |
| C02 / Easy | A fake login email that tries to steal credentials is an example of... | Phishing | Load balancing | Compiling | Compression | A |
| C03 / Medium | What does MFA stand for? | Multi-Factor Authentication | Main Firewall Access | Multiple File Archive | Managed Fast Algorithm | A |
| C04 / Medium | Why should software receive security updates? | They always increase screen brightness | They can patch known vulnerabilities | They replace every password | They guarantee no future attacks | B |
| C05 / Hard | What does the principle of least privilege recommend? | Give everyone admin rights | Grant only the access needed for a task | Use the same password everywhere | Disable all logs | B |
| C06 / Hard | Why are unique salts used when hashing passwords? | To make passwords readable | To reduce effectiveness of precomputed hash attacks | To remove the need to hash | To speed up brute forcing | B |

### AI / data

| ID / level | Question | A | B | C | D | Correct |
|---|---|---|---|---|---|---|
| D01 / Easy | What does CSV stand for? | Compressed Script Value | Comma-Separated Values | Central Server Version | Computer Syntax View | B |
| D02 / Easy | A machine-learning model generally learns patterns from... | Training data | Monitor brightness | USB cables | DNS records only | A |
| D03 / Medium | Which SQL clause groups rows for aggregate calculations? | `WHERE` | `ORDER BY` | `GROUP BY` | `LIMIT` | C |
| D04 / Medium | A false positive means... | A real positive correctly predicted positive | A real negative incorrectly predicted positive | A real positive predicted negative | A missing prediction | B |
| D05 / Hard | What is data leakage in machine learning? | Using future/unavailable information during model development | Deleting a CSV on purpose | Encrypting a dataset | Compressing a parquet file | A |
| D06 / Hard | Why is Apache Spark useful for very large datasets? | It processes data only in a web browser | It supports distributed data processing | It replaces all SQL syntax | It works only with spreadsheets | B |

### Development / web

| ID / level | Question | A | B | C | D | Correct |
|---|---|---|---|---|---|---|
| W01 / Easy | What is HTML mainly used to describe? | Webpage structure and content | Computer fan speed | Password hashing | Wi-Fi channels | A |
| W02 / Easy | What is CSS mainly used for? | Database backups | Styling web pages | Compiling Python | Tracking IP routes | B |
| W03 / Medium | Which HTTP method is normally used to retrieve a resource? | `GET` | `DELETE` | `PATCH` | `POST` | A |
| W04 / Medium | What does `git commit` primarily do? | Permanently delete the remote repo | Record a snapshot of staged changes | Publish a website automatically | Install dependencies | B |
| W05 / Hard | Linear search through an unsorted list has worst-case time complexity... | `O(1)` | `O(log n)` | `O(n)` | `O(n²)` | C |
| W06 / Hard | A Git merge conflict usually means... | Git needs human help combining overlapping edits | The internet connection is down | The repo has no commits | A file has become read-only | A |

## Quiz data-quality instructions

- Use explanations that are short and accurate when showing the answer.
- Do not accidentally make two answer choices both correct.
- Treat the listed `Correct` field as authoritative when seeding the database/module.
- Escape code text properly and preserve case (`GET`, `GROUP BY`, etc.).
- Keep the answer key on server only, even when demo mode is enabled.

---

# 10. Build sequence for Codex

Implement in practical milestones, but **deliver the complete working MVP** before stopping:

**Milestone A — foundation and design system**  
Initialize Next.js + TS + Tailwind, implement fonts/colors/tokens, original high-end arcade design, responsive Home/game cards/leaderboard UI, polished nickname modal, accessible shared UI components.

**Milestone B — functional gameplay**  
Implement all four actual games with timers, event capture, scoring, responsive input, real finish/quit states, animations, and isolated pure scoring functions.

**Milestone C — integrated Next.js competitive backend + Neon**  
Implement Route Handlers under `src/app/api`, per-game normalized nicknames, existing-name confirmation, Drizzle schema/migrations for Neon Postgres, expiring sessions, idempotent scored submissions, concurrency-safe personal-best updates, leaderboard rank retrieval, and server-side trivia grading. Wire the UI to backend; verify different-game nickname reuse. No Express app and no Supabase client.

**Milestone D — stand readiness**  
Add admin login/moderation/reset/export, demo mode, production mode errors, save retry, loading/empty states, keyboard/touch handling, sound muted by default, reduced motion, metadata/favicon, and shareable public URL.

**Milestone E — one-project Vercel readiness**  
Run automated tests and manual gameplay smoke tests. Ensure production build succeeds. Add auto-migrations, validated secrets, a GitHub/Vercel deployment guide with Vercel Marketplace Neon provisioning, a deploy button once repository URL exists, no manual SQL, production health check, and exact steps for resetting test data and printing/sharing the live QR link.

## Final instruction to Codex

**Do not stop after writing a plan. Write the entire SINGLE full-stack Next.js application, all React UI and all `/api` server routes, game logic, tests, migrations, and README; run locally/build/test, fix failures, and report precisely what works and which external credentials or GitHub/Vercel confirmations are still needed. Make this a ONE-Vercel-project deploy, using Neon via the Vercel Marketplace for durable data. Prioritize the specific game flows, separate leaderboards, per-game nickname logic, and premium N7Geeks graphic style over unnecessary features. Do not deploy a second backend, require manual database SQL, expose secrets, or replace a missing database with fake production scores.**
