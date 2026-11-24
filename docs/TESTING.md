# Testing & verification strategy

This document is the honest record of what can and cannot be verified in this project.
It supports `AGENTS.md` §3, §7, §10. **Nothing here is a fabricated metric.**

## 1. Current harness

| Layer | Mechanism | Command | Status |
|---|---|---|---|
| Structure / scaffold | `scripts/verify.mjs` (zero dependencies, Node 22+) | `node scripts/verify.mjs` | Reference check — **partial gap** |
| Compile / bundle | Vite production build | `vite build` (via `npm run verify`) | Real compile gate for all Vue SFCs |
| Game logic (quiz, SRS, weakness, parsing) | `node:test` (built into Node 22) on helpers in `src/store.js` | — | **Gap** — see §4 |
| Auth logic (bcrypt, HMAC session, env validation) | `node:test` — `tests/auth.test.js`, `tests/config.test.js` | `npm test` | Real bcrypt/HMAC; no DB needed |
| Auth HTTP endpoints | `node:test` — `tests/auth-middleware.test.js`, real `http` server on port 0 via `fetch` | `npm test` | Fake pool only at the DB boundary |
| Node-RED wiring | `node:test` — `tests/nodered.test.js`, spawns Node-RED with a temp userDir and real settings | `npm test` | Checks `/api/health`, `/api/me`, `httpStatic` `/`, `/admin`, production fail-fast |
| Auth against Postgres | `node:test` — `tests/auth-db.test.js` | `npm test` | Skipped unless `TEST_DATABASE_URL` is supplied |
| UI / state stores | Manual browser smoke test | see §3 | **Gap** — no component runner |
| E2E | Manual, role-based locators / user-visible assertions | see §3 | **Gap** — no E2E framework |
| Mutation testing | None available | — | **Gap** — never invent a score |

`npm run verify` runs `scripts/verify.mjs`, then `vite build`, then `npm test` (`node --test` on
the six test files). The build runs before the tests so `httpStatic` has a `dist/` to serve. The structural script fails fast with descriptive messages when the
entry artifact, package manifest, Vue source tree, the documented storage key, the architecture
markers or the auth boundary (cookie flags, CSRF header, gitignored `.env`) are broken, or when
an SFC has unbalanced tags. The tests exercise auth logic and real HTTP behavior; the build
compiles every component template and script. Game logic itself still has no automated runner.

Run the check **once, after the red-team subagent reports**, not before and not in a loop
(`AGENTS.md` §1, §5, §6). The whole project is one cheap gate.

## 2. What to add when changing behavior

For every new or changed behavior, add a corresponding check — a case in `scripts/verify.mjs`
if the change is structural, or a documented manual case below if it is behavioral. Target a
1:1 test-to-code ratio at the layer you touch. Assertions must be fail-fast and descriptive.

Behavioral cases worth keeping in the manual suite (happy / error / edge):

| Area | Happy path | Error path | Edge cases |
|---|---|---|---|
| Paste import | two tab-separated columns → deck populated | clipboard denied → fallback textbox | empty text, duplicate pairs, separators `;`, `\|`, ` - `, `,`, surrounding quotes |
| Quiz | 4+ word deck, answer correct, score > 0 | wrong answer / timeout scores 0, streak resets | 3 words (cannot play), `0` questions = all words, seconds 3 and 60, key `1`–`4`, Enter/Space |
| Flashcards | due card → grade Good → interval grows | corrupt `fs` → treated as new card | ease clamp 1.3–3.0, Again repeats in session, 0 cards → caught-up screen |
| Analytics | weakness ranking orders weak words first | `null` / missing `s` → weight `0.6` | unanswered word = `0.6`, average time > 8s adds `0.1` |
| Backup/restore | export → import round-trips | malformed/wrong-typed JSON → app still loads | huge arrays, quota exceeded, overwrite confirmation |
| Theme | toggle persists across reload | blocked storage → system preference | light/dark/system, no-flash on load |
| Layout | desktop and mobile widths | offline fonts → system fallbacks | safe-area insets |
| Member login | valid credentials → status shows email; logout → form returns | wrong password / unknown email → same generic error; DB down → generic 401 | empty fields, double submit, tampered cookie, expired session, `SameSite`/`Secure` flags, CSRF header on logout |
| Member page availability | backend running → `/api/me` resolves | backend stopped → four drill screens still work, Member shows "service unavailable" | refresh keeps session, light/dark theme, mobile width |

## 3. Manual browser smoke procedure

For any user-journey change (`AGENTS.md` §4):

1. `npm run dev` (or `npm run build` + `npm run preview`) and open the local URL in
   Chrome/Edge **and** Firefox or Safari if available.
2. Check desktop width and a narrow mobile width.
3. Check light, dark, and system theme (reload to verify no flash and persistence).
4. Walk the affected journey end-to-end using the cases in §2.
5. Open DevTools console — there must be no new uncaught errors.
6. Test offline once (devtools offline / no network) to confirm font fallback.
7. For the Member journey, run `npm run server` in a second terminal alongside `npm run dev`,
   sign in and out, refresh mid-session, then stop the backend and confirm the drills still work
   and the Member page degrades to the "service unavailable" card.
8. Record exactly what was checked in the gate report.

## 4. Documented gaps — how we compensate

- **No unit framework for game logic.** Game logic is plain functions in `src/store.js`;
  today we compensate with explicit edge-case manual cases above and the structural + build
  checks. Auth and config use the built-in `node:test` runner, so no new test dependency was
  added.
- **No mutation testing.** No suitable tool is configured. Compensate with higher branch
  coverage on the four sections. Never report a mutation score.
- **No E2E framework.** Compensate with the role-based manual smoke procedure.
- **No lint / format config.** Keep style consistent with the existing files; `npm run verify`
  catches structural and compile regressions only.
- **No temp-dir/fixture strategy needed.** The app writes no files. Isolate state with a fresh
  browser profile or by clearing only `localStorage['vocabdrill.v1']`.
- **No browser E2E runner.** Member UI assertions are manual; `tests/auth-middleware.test.js`
  covers the HTTP contract and `tests/nodered.test.js` boots the real Node-RED runtime, but neither
  exercises DOM interactions.
- **Real DB test is conditional.** `tests/auth-db.test.js` is skipped without
  `TEST_DATABASE_URL`; the user supplies the connection string. Other tests stub only the DB
  boundary — bcrypt, HMAC and HTTP are real.
- `node_modules/`, `dist/` and `.env` are generated/secret and gitignored; `package-lock.json`
  and `.env.example` are committed.

A documented gap is better than a hidden one. If a check is flaky or skipped on a platform,
name it and the reason here — never delete it to get a green run.
