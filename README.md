# N7GEEKS // ARCADE

Four independent competitions, one full-stack Next.js application. Pick **REACTION.EXE**, **MEMORY.STACK**, **AIM//TRAINER** or **GEEK.CHECK**. Each game has its own nickname namespace, personal best and leaderboard. There is no aggregate score.

Built with Next.js App Router, React, TypeScript, Tailwind, original CSS/SVG graphics, the supplied N7Geeks logo, Drizzle and Neon PostgreSQL. All `/api` endpoints deploy alongside the UI in one Vercel project. Fonts are packaged locally; gameplay needs no external trivia, image or AI service.

## Run locally

Requires Node.js 24 and npm (matching the Vercel runtime). From the repository root:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

PowerShell users can use `Copy-Item .env.example .env.local` instead of `cp`. Open [localhost:3000](http://localhost:3000). On a phone on the same network, use the laptop's LAN IP and port 3000, and allow the development server through the firewall if needed.

The example explicitly sets `DEMO_MODE=true`. The yellow **DEMO MODE — SCORES NOT SHARED** banner stays visible. Demo records live in the current Node process and can disappear on restart; they are not a durable shared leaderboard. No credentials or SQL are needed for local demo play. The local organizer password is **`local-arcade-demo`** at [/admin](http://localhost:3000/admin). You can override it with `ADMIN_PASSWORD` locally.

For a local production-style demo build:

```sh
npm run build
npm start
```

Stop `npm run dev` before starting the production server on the same port.

## Verify

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium --only-shell
npm run test:e2e
npm run build
```

Playwright covers desktop (1366×768 and 1920×1080), mobile (375×812), the tag dialog and focus, all four games, keyboard/pointer input, automatic result return, retries across refresh, admin access and cross-site request rejection. `PLAYWRIGHT_EXECUTABLE_PATH` can point to an existing compatible Chromium executable. Browser artifacts and screenshots are written to ignored `test-results/`.

Vitest covers the four exact scoring algorithms, nickname normalization, independent namespaces, collisions/retries, concurrent idempotent finishes, best-score preservation, reset isolation, server quiz grading, cookie signing/expiry and production configuration safeguards. Those repository tests use the local in-memory transaction implementation. They do **not** establish that cloud credentials, Neon connectivity or an actual deployment work.

## Production: GitHub → Vercel → Neon

Source repository: [AymanJanati/trivian7](https://github.com/AymanJanati/trivian7). Hosting/database credentials are never included in Git. The following steps use your own accounts and secrets.

1. Publish this complete repository to an actual GitHub repository. Commit the lockfile and `drizzle/` migrations. Do not commit `.env.local`.
2. Import that GitHub repository through **Vercel → Add New Project**, with Next.js and the repository root selected. Keep `npm run build` as the build command.
3. Add [Neon through Vercel Marketplace](https://vercel.com/marketplace/neon), attach it to this project, choose a nearby region and approve the plan. Check the injected environment variables. Map the integration's PostgreSQL connection string to the server-only **`DATABASE_URL`** if it is named differently. Use the Neon URL, including its required TLS options.
   Keep the integration's **`DATABASE_URL_UNPOOLED`** variable too: migrations use this direct connection so the migration lock stays on the same database session. Runtime queries continue to use pooled `DATABASE_URL`.
4. Set **`ADMIN_PASSWORD`** to a unique password of at least 12 characters and **`SESSION_SIGNING_SECRET`** to a cryptographically random value of at least 32 characters. Generate the latter with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and save it privately. These values never use a `NEXT_PUBLIC_` prefix.
5. Unset `DEMO_MODE` or set it to `false` on Vercel. Demo mode is refused on **all** Vercel deployments. Confirm that you selected the intended production database.
6. Deploy or redeploy once Neon and secrets are attached. The build validates configuration, acquires a database advisory migration lock and applies the committed Drizzle migrations automatically **before** `next build`. No SQL editor or separate backend deployment is required. Failed configuration/migrations stop the build.
7. Open `/api/health` on the deployed URL. It must return `ok: true`, `mode: "live"`, `database: "neon"`. Verify that the public UI says live and that `/admin` accepts the production password.
8. Play on a laptop and a phone. Reuse the same tag in different games; confirm no cross-game conflict. Replay a tag in the same game and confirm the returning-player choice. Refresh the other device and verify scores persist across refresh, cold starts and redeployment.

The button below opens Vercel's setup flow for [AymanJanati/trivian7](https://github.com/AymanJanati/trivian7). Run `npm run deploy:button` to regenerate the documented [public template clone button](https://vercel.com/docs/deploy-button). To deploy directly from this repository with future pushes, use **Vercel → Add New Project → Import Git Repository** and select `AymanJanati/trivian7`. The script refuses missing/non-GitHub remotes. A button begins account authorization and project setup; it cannot bypass Neon approval or secret entry.

<!-- deploy-button:start -->

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FAymanJanati%2Ftrivian7&env=ADMIN_PASSWORD,SESSION_SIGNING_SECRET)
<!-- deploy-button:end -->

## Real local database and previews

Use a **development Neon branch**, not the event database, for local development. Link the Vercel project and pull environment values:

```sh
vercel link
vercel env pull .env.local
npm run db:migrate
npm run dev
```

`vercel env pull` may overwrite `.env.local`. Back up existing local flags privately first; afterward explicitly set `DEMO_MODE=false`, verify the database URL points to the development branch and preserve the required secrets. Do not print or commit credentials. `npm run db:migrate` is a no-op in explicit local demo mode, so disable demo mode before running it against Neon.

Preview deployments are **blocked** unless `PREVIEW_DATABASE_ISOLATED=true` is explicitly configured. Set this only after attaching a separate Neon preview branch through the integration. A boolean cannot verify database identity: the organizer must ensure the preview URL is genuinely isolated. Never give previews the live event database URL. Preview builds perform the same migrations and can write game/admin data.

## Database and transaction design

`src/db/schema.ts` defines `leaderboard_entries`, `game_sessions`, `attempts` and `request_limits`. Generated migrations and metadata are checked into `drizzle/`. To change the schema, edit the typed schema, run `npm run db:generate`, review the generated migration for non-destructive changes, and commit it. Builds never seed or reset scores.

The runtime uses the [Neon WebSocket Pool driver with Drizzle](https://orm.drizzle.team/docs/connect-neon) in Next.js's Node runtime, with explicit interactive transactions. Each transaction obtains a PostgreSQL advisory lock scoped to a game. Start, finish, rename collision recovery, trivia answers, deletion and reset share this lock. This deliberately favors simple, correct booth-scale concurrency. Connections are closed after each operation; no always-on server, worker, Redis or WebSocket application service is needed.

Finishing atomically saves the attempt, updates a better personal best, increments the attempt count, stores the result and closes the session. Unique indexes on `(game_id, rules_version, normalized_name)` and `attempts.session_id` enforce independent identities and one attempt per session. An identical retry returns the original result. A free tag taken during the run produces `NAME_COLLISION`; the same completed data and token can be retried with a different tag. No leaderboard row is created at start. Moderation removes the chosen game's matching row **and its attempts/sessions in the current rules version**. A full game reset removes only that game's current-format records and invalidates its active runs.

Ranks sort by score descending, tie-break ascending, achieved timestamp ascending and normalized name deterministically. Incomplete Aim tie-breaks use misses; completed runs use completion milliseconds. Memory uses the time of the last successfully completed round. Public responses omit identity IDs, tokens, answer keys and admin data. Scoreboards use `Cache-Control: no-store` and poll every ten seconds on Home.

## Timing, identity and interruption rules

- **Memory (format 2):** ten independent sequences of 3–12 tiles. Each round gets a fresh pattern, never the previous opening or an immediate repeated tile. Flashes accelerate from 450 ms to 180 ms, with gaps narrowing from 160 ms to 97 ms. Input windows last at least six seconds (1.8 seconds per tile for longer rounds), with a visible input countdown and a two-minute overall ceiling. Completed-round awards are **30, 40, 50, 60, 80, 100, 120, 140, 170, 210**, totaling 1,000. A wrong tile or expired window ends the run; partial rounds earn nothing.
- **Geek Check (format 2):** fifteen questions from a 90-question bank, retaining the original 30 and adding 60. Every run covers each of the five topics once at each level: five easy, then five medium, then five hard. Easy questions allow 10 seconds and up to 40 points; medium allow 12 seconds and up to 65 points; hard allow 15 seconds and up to 95 points. A correct answer earns `round(maxPoints × (0.8 + 0.2 × remainingFraction))`; wrong or expired answers earn zero. Accuracy carries most of the score, with later questions contributing more. The maximum remains 1,000.
- Rules are centralized in `src/lib/rules.ts`. Memory and Trivia now use rules version 2; Reaction and Aim remain version 1. The non-destructive second migration retains earlier scores as version 1 and separates the new boards. Older records remain in the database, excluded from current rankings, nickname checks and admin resets/exports. No previous score is converted into the harder format. Reload any page already mid-run before the update; old-format pending runs cannot enter the new board.
- Reaction supports Space/Enter and pointer input. False starts, timeouts and times under 100 ms score zero. Memory supports keys 1–9; Trivia supports keys 1–4. Aim targets remain within the field and have at least 52 CSS-pixel hit areas on mobile.
- Trivia randomizes topic order within each difficulty tier and randomizes all answer options. Answer keys stay in `src/lib/trivia/questions.server.ts` and `src/lib/trivia/advanced.server.ts`. A question is opened and timed on the server. Answers are locked and graded there. The public question response contains no correct-answer key; feedback reveals it only after that answer is closed.
- Other game events are shape/range/order checked and scores are recomputed server-side. Memory verifies the server-generated sequence and replay timing. Browser reaction/aim/memory events remain forgeable by a determined user. This is a casual booth competition, not a cheat-proof tournament. Identical stand hardware improves fairness.
- Returning players claim their tag on trust; **YES, THAT'S ME does not authenticate ownership**. Unicode NFKC normalization, whitespace collapse and case normalization apply within one game. Names support Unicode letters/marks/numbers, spaces, underscores and hyphens.
- Sessions expire after five minutes. Quitting requires confirmation and submits no score. Timers keep running in the quit dialog. **Hiding the tab interrupts the run and returns Home without submitting it**; there is no silent pause. Do not switch tabs during a competition run.
- Failed completed submissions are retained in this browser's local storage for explicit retry, including across refresh. This stores only a pending run, never an official leaderboard. A successful retry removes it. Expired runs cannot be saved; the UI keeps discard available. If local storage is unavailable, retry remains available until the page closes.
- Sound is optional and muted on every new visit. Reduced-motion preferences suppress decorative transitions; essential game cues remain visible. No camera, microphone or geolocation permissions are requested.

## Organizer operations and launch checklist

1. Verify the correct Vercel Production environment, intended Neon database and `/api/health` live response.
2. Log into `/admin` with the configured password. Signed HTTP-only, same-site cookies expire after eight hours. Every admin API read/write independently checks authorization; POSTs also require the same public origin. Admin login is rate-limited. A hashed-IP, database-backed limit allows generous public traffic from shared school Wi-Fi.
3. Export the four boards separately to CSV if needed. CSV cells escape quotes and spreadsheet formula prefixes.
4. Remove an abusive name with the per-row confirmation, or select a game and type **`RESET REACTION`**, **`RESET MEMORY`**, **`RESET AIM`** or **`RESET TRIVIA`** before resetting it. Resets are permanent; export before removing wanted data.
5. Reset test scores in each intended board. Test the same-name/different-game and returning-player paths, and confirm a worse replay keeps the best.
6. Test the actual public URL on the shared laptop and a phone, refresh from both devices, and check a redeployment does not erase the boards. Sign out of admin on the stand laptop.
7. Create/print a QR code **only for the verified production URL** (or connected custom domain). No example URL or QR code in this repository claims to be a live event link.
8. Keep sound muted unless wanted, use the same hardware for close competitions, and keep the game tab visible.

## Project map

- `src/components/arcade.tsx`: home, selected leaderboard, nickname dialog, finish/retry/results.
- `src/components/games.tsx`: the four real game controls and timers.
- `src/components/admin.tsx`: organizer login, moderation, export and reset.
- `src/lib/games.ts`: editable game metadata and primary UI copy.
- `src/lib/ui-copy.ts`: editable English interface labels and dynamic messages.
- `src/lib/scoring.ts`: pure, validated score calculations.
- `src/lib/rules.ts`: shared difficulty curves, timers, point weights and format versions.
- `src/lib/memory.server.ts`: fresh per-round sequence generation.
- `src/lib/trivia/advanced.server.ts`: additional medium/hard questions and explanations.
- `src/lib/competition.ts`: game sessions, grading and atomic completion.
- `src/app/api/[...path]/route.ts`: same-origin Next.js API routes.
- `src/db/`: typed schema, Neon connection and transactional repository.
- `scripts/prepare-build.mjs`: configuration validation and locked auto-migrations.
- `public/n7geeks.svg`: supplied official artwork, unchanged.

API paths: `GET /api/health`, `GET /api/leaderboard?gameId=…`, `POST /api/nickname/check`, `/api/game/start`, `/api/game/question`, `/api/game/answer`, `/api/game/finish`, `/api/game/abandon`; organizer paths are `/api/admin/login`, `/logout`, `/board`, `/export`, `/delete` and `/reset`. Request bodies are validated with Zod. All access stays within this Next.js deployment.

## Verification boundary

Verified locally on 2026-10-18: `npm run typecheck`, `npm run lint`, all **39 Vitest tests**, all **7 Playwright scenarios**, and `npm run build` passed. The compiled app also passed a local production-server smoke check for health, starting a game and quitting it. Browser checks included all four games, the complete fifteen-question quiz, and the three specified viewport sizes. The supplied SVG matches the original file unchanged, and the private trivia bank was absent from the browser's static chunks.

Local automated checks and browser verification can validate this repository and demo flows. Live Neon provisioning, live migration execution, persistence across Vercel cold starts/redeployments, a real GitHub deploy button and two-device production acceptance require the real external accounts/database. These are not represented as completed by local tests.
