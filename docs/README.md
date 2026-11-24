# Vocab Drill — architecture & operations

High-level reference for agents and humans. User-facing documentation lives in
[`../README.md`](../README.md); user-journey behavior specs live in [`specs/`](specs/).
The agent workflow contract lives in [`../AGENTS.md`](../AGENTS.md).

## 1. What the system is

A Kahoot-style + Anki-style vocabulary drill built as a **Vue 3 single-page app with Vite**.
Screens are Vue single-file components; shared state and pure logic live in `src/store.js`.
The drills need no server and produce a static bundle in `dist/`. Google Fonts are progressive
enhancement with system fallbacks.

The only drill persistence is browser `localStorage` under the key `vocabdrill.v1`. Backups are
copy/paste JSON because the app writes no files to disk.

A separate, optional **Express backend** adds one protected page (Member). It uses Postgres for
the single user and `bcryptjs`, and serves only auth endpoints; it does not touch the drill data.

## 2. Architecture map

| Region | File / symbols | Responsibility |
|---|---|---|
| Theme bootstrap | inline `<script>` in `index.html` | Reads `vocabdrill.theme` before first paint to avoid a light/dark flash. |
| Entry / styles | `src/main.js`, `src/style.css` | Mounts the app; global CSS variables for light/dark, responsive layout, card/option styles. |
| Core state | `src/store.js` — `db`, `save()`, `replaceDb()`, `normalize()`, `weak()` | Reactive store + defensive persistence; smoothed weakness score used for weighting and ranking. |
| Theme | `src/useTheme.js`, `components/ThemeToggle.vue` | Reactive `theme` ref mirrored to `<html data-theme>`. |
| Screen machine | `src/App.vue` | One view mounted at a time; navigation events (`home`, `play`, `review`, `stats`, `drill`, `member`). |
| Home | `components/HomeView.vue` — `/* ---------- Home ---------- */` | Deck list and settings, paste import (`parsePaste`, `addPasted`), paste history, JSON backup/restore. |
| Quiz | `components/QuizView.vue` — `/* ---------- Quiz ---------- */` | `start`, `ask`, `pick`, `next`, `finish`. Weighted shuffle, 4 options, timer, score/streak, missed words. |
| Flashcards | `components/ReviewView.vue` — `/* ---------- Flashcards ---------- */` | `review`, `drawCard`, `reveal`, `rate`, `finishReview`. Due queue, ease/interval scheduling, session summary. |
| Analytics | `components/AnalyticsView.vue` — `/* ---------- Analytics ---------- */` | Weakness ranking, "ever graded Again or Hard", targeted drills. |
| Member | `components/MemberView.vue`, `LoginView.vue`, `src/api.js` | Protected page: checks `/api/me`, shows sign-in form or status + logout. |
| Auth server | `server/config.js`, `auth.js`, `db.js`, `index.js` | Fail-fast env config, bcrypt + dummy hash, HMAC-SHA256 signed sessions, `pg.Pool`, Express endpoints. |

### Data flow

```
Excel/Sheets paste → parsePaste → addPasted → db.decks[...].words → save()
         ↓
    Home (deck list) → Quiz (weighted draw, timer, score) ─┐
                     → Review (due queue, grade → fs)      ├→ save() → stats/analytics → drills
                                                           ┘
    Backup (JSON string) ←→ db ←→ Restore (JSON string)
```

Navigation between screens is local component state in `App.vue` (no router dependency).
Because only one view is mounted at a time, quiz timers and review keyboard listeners are
torn down in `onUnmounted` when the user navigates away.

```text
Member button → /api/me ── 200 → signed-in status + Logout
                        └─ 401 → LoginView → POST /api/login → HttpOnly cookie → /api/me
```

Vite proxies `/api` to `http://127.0.0.1:3001` in dev, so the browser sees a single origin.
Production can set `VD_FRONTEND_ORIGIN` for an explicit cross-origin CORS allowance.

## 3. Data model (`vocabdrill.v1`)

```json
{
  "decks":    { "<name>": { "name": "...", "colA": "...", "colB": "...", "words": [ "<word>" ] } },
  "sessions": [ { "id": "...", "date": 0, "n": 20, "ok": 16, "score": 12450 } ],
  "pastes":   [ { "date": 0, "deck": "Pasted words", "n": 5, "added": 4, "words": [ { "a": "...", "b": "..." } ] } ],
  "cfg":      { "dir": "mix", "n": 20, "cards": 20, "sec": 15, "focus": true }
}
```

A **word** is `{ k, a, b, s, fs }`:

- `k` = `a|b` identity key; `a`, `b` = the two column values.
- `s` = quiz stats: `n` tries, `c` correct, `t` total seconds, `last` timestamp (or `null`).
- `fs` = flashcard schedule: `d` due (ms), `i` interval (days, `0` = learning), `e` ease
  (clamped 1.3–3.0), `r` reviews, `l` times graded Again, `h` times graded Hard. `l` and `h`
  are permanent; a later Good/Easy does not erase them. No `fs` = new card.

**Weakness** (used for "needs more practice" and weighted shuffle):

```
weakness = (wrong + 1) / (tries + 2)
weakness += 0.1  if average answer time > 8s
weakness = min(weakness, 1)
```

Unanswered words are treated as `0.6`. Weight for the optional weak-word focus is
`0.2 + 2 × weakness`. See [`../README.md`](../README.md) for the full scoring rules.

## 4. Operations

- **Run:** `npm install` then `npm run dev` (Node.js 22+). Open the printed local URL.
- **Member backend:** copy `.env.example` → `.env`, set `DATABASE_URL` and `VD_SESSION_SECRET`,
  then run `npm run db:migrate`. The user creates the credential with `npm run hash-pw`,
  puts the hash in `VD_SEED_HASH` and an email in `VD_SEED_EMAIL`, and runs `npm run seed-user`.
  Run `npm run server` alongside `npm run dev`.
- **Build:** `npm run build` → static `dist/`; `npm run preview` rebuilds first, then serves it locally.
- **Import:** copy two headerless columns from Excel/Sheets → **Paste from clipboard**.
  Separator precedence: tab, `;`, `|`, ` - `, `,`. Exact `a + b` duplicates are skipped.
  A deck needs ≥4 pairs for quiz rounds; flashcards work with fewer.
- **Back up:** Home → **Show backup (JSON)** → copy the text into a file.
- **Restore:** Home → **Restore from JSON** → paste the saved text (replaces current data).
- **Move devices:** data is per browser and per page address; use the JSON backup.
- **Reset test state:** clear only `localStorage['vocabdrill.v1']` (and `vocabdrill.theme`
  for theme) in a throwaway browser profile. Never clear the user's real profile.
- **Verify a change:** `npm run verify` (structural checks + `node:test` + `vite build`), then a
  manual browser smoke test. See [TESTING.md](TESTING.md).

## 5. Known limitations / gotchas

- No typing mode; one accepted answer string per word.
- Pasted words always go to the "Pasted words" deck.
- No single-word edit/delete — restore an edited backup instead.
- No cross-device sync; JSON backup is the transfer mechanism.
- Clearing site data deletes saved data — back up first.
- Deleting a deck also deletes its round history. Paste history keeps all entries (home
  shows the latest 20).
- Google Fonts require network; without it the system font stack is used.
- Restore accepts arbitrary JSON from the clipboard: `normalize()` in `src/store.js` handles
  malformed/wrong-typed shapes defensively.
- `Vocab Drill.html` is kept only as the legacy reference the Vue app was ported from; it is
  not a build input or verification gate.
- The Member token is self-contained: logout clears the cookie but cannot revoke a copied token
  before `exp`. Rotating the password after a compromise must be paired with rotating
  `VD_SESSION_SECRET`. No rate limiting is built into `/api/login`.
- `tests/auth-db.test.js` needs a real `TEST_DATABASE_URL` supplied by the user; otherwise it is
  skipped. Other auth tests use a fake pool only at the DB boundary with real bcrypt/HMAC/HTTP.
