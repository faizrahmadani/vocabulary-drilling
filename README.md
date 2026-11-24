# Vocab Drill
This repository contains AI generated code. Please do keep in mind that this project serves solely as a platform for language vocabulary drilling.

A Kahoot-style vocabulary quiz for memorizing and revising a language (built around Korean ↔ English, but it works for any two-column word list). The drills are a Vue 3 single-page app built with Vite and keep all data in the browser. A small optional Node backend adds a protected Member page; the four drill screens work without it.


## Features

- **Anki-style flashcards**: flip a card, grade yourself Again / Hard / Good / Easy, and let a spaced-repetition schedule decide what comes back.
- **Kahoot-style rounds**: the question sits at the top, with four colored answer buttons below.
- **Paste import**: copy two columns from Excel or Sheets (no header) and press **Paste from clipboard**.
- **Unpredictable order**: every round is freshly shuffled, and each word appears at most once per round.
- **Weak-word focus**: optionally show the words you struggle with more often (the order stays random).
- **Analytics**: a per-deck ranking of the words that need more practice, a permanent list of words ever graded Again or Hard, plus round history.
- **Targeted drills**: drill your 20 weakest words, 20 unseen words, or the words you just missed.
- **Automatic saving**: results, decks and paste history are stored in the browser, with a JSON backup you can copy and restore.
- **Light and dark mode**: toggle in the home header; follows the system setting until you choose, then remembers your choice. Works on desktop and mobile.
- **Member page**: a separate page behind a real server-side login (Express + Postgres + bcrypt + signed cookie). The drill screens stay open and work offline.

## Quick start

Requires Node.js 22+ and npm.

```powershell
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`) in a modern browser (Chrome, Edge,
Firefox, Safari). To produce a static production bundle in `dist/`, run `npm run build`;
`npm run preview` rebuilds first, then serves that bundle locally so the Member page is never
missing from a stale artifact. To run the project's checks, use `npm run verify`.

1. Paste a word list (see below).
2. Choose your round settings and press **Play**.

### Member page (optional backend)

The **Member** button in the home header opens a page that is only visible with a valid session. Local setup:

1. Copy `.env.example` to `.env` and fill in `DATABASE_URL` (Postgres) and `VD_SESSION_SECRET`
   (at least 32 characters in production). `.env` is gitignored.
2. Run `npm run db:migrate` (creates the `users` table).
3. Run `npm run hash-pw`, then put the printed hash in `VD_SEED_HASH` and your email in
   `VD_SEED_EMAIL` in `.env`. Run `npm run seed-user`. Only you handle the password.
4. In separate terminals run `npm run server` (API at `http://127.0.0.1:3001`) and `npm run dev`.
   Vite proxies `/api` to the backend, so no CORS setup is needed locally.

Sign in with that email and password. The session cookie is `HttpOnly`, `SameSite=Lax` and
valid for 24 hours; `Secure` is added automatically in production. **Log out** clears it.
When the backend is not running, the four drill screens still work, and the Member page shows
a clear "service unavailable" message instead of a login form.

## Word list format

Copy rows **without a header**, for example:

```
항목	Item
필수	Required/Essential
```

Each line is split on the first separator found, checked in this order: tab, `;`, `|`, ` - `, `,`. Excel and Sheets copy as tab-separated text, so no extra work is needed. Surrounding quotes are removed.

- Pasted words go into a deck called **Pasted words** (columns Korean / English). Exact duplicate `column 1 + column 2` pairs are skipped, and the status line plus paste history show how many were skipped.
- Every paste is saved immediately and listed under **Paste history** on the home screen (date and time, rows pasted, how many were new, and the words themselves). The trash button clears the history after confirmation; deck words and stats stay.
- If the browser blocks direct clipboard access, a text box appears. Paste into it with Ctrl+V (or long-press and Paste on a phone) and the words are added right away.
- A deck needs at least **4 word pairs** for quiz rounds. Flashcards work with fewer.

## Playing a round

| Setting | Default | Notes |
|---|---|---|
| Direction | Mixed | Column 1 → 2, column 2 → 1, or random per question |
| Questions | 20 | `0` plays every word in the deck |
| Seconds | 15 | Time per question (3–60) |
| Show weak words more often | On | Weighted shuffle, see below |

- The three wrong options are taken from other words in the same deck.
- **Keyboard**: press `1`–`4` to answer, and `Enter` or `Space` to go to the next question.
- A correct answer scores `500 + 500 × (time left ÷ time limit)`, plus `50` per streak step (the bonus is capped at 5 steps). Wrong answers and timeouts score 0 and reset the streak.
- At the end you see your score, accuracy, best streak and the words you missed.

## Reviewing flashcards

Each deck has a **Review** button on the home screen. **Review cards** in Round settings sets the session size (`0` = all cards). Due cards are queued before new cards.

1. Read the front (column 1 or column 2, depending on **Direction**).
2. Click the card, tap it, or press `Space` / `Enter` to reveal the answer.
3. Grade yourself with `1`–`4` or the four buttons:

| Grade | Effect |
|---|---|
| Again (`1`) | Ease drops, the card returns to learning, and it is repeated later in the round (due in 1 minute). |
| Hard (`2`) | Ease drops slightly; a new card waits 10 minutes, otherwise the interval grows by 1.2×. |
| Good (`3`) | A new card is scheduled 1 day out; otherwise the interval is multiplied by the card's ease. |
| Easy (`4`) | Ease rises; a new card is scheduled 3 days out, otherwise the interval is multiplied by ease × 1.3, minimum 2 days. |

- Ease is clamped to `1.3`–`3.0`; interval is stored in days, due date in milliseconds.
- **End** finishes the session and shows grade counts, still-due cards, the cards marked Again or Hard in that session, and a **Keep reviewing** button.
- **Copy list** on the session summary or in **Analytics → Ever marked Again or Hard** copies those words as `column 1` + tab + `column 2`, one pair per line, ready to paste into Excel or back into the app.
- A word's Again and Hard counts are permanent. A later Good or Easy grade does not remove it from **Analytics → Ever marked Again or Hard**.
- The session limit applies to the initial queue; cards graded Again repeat within that session, so total card views can exceed the limit.
- The card front shows when the card is next scheduled and its current ease.
- Direction is shared with quiz rounds: Mixed picks a random direction per card.

## How "needs more practice" is calculated

For each word that has been answered at least once:

```
weakness = (wrong + 1) / (tries + 2)      # smoothed error rate
weakness += 0.1  if average answer time > 8 seconds
weakness = min(weakness, 1)
```

- Words with a weakness of **0.4 or higher** count as "need more practice".
- Words never answered are treated as `0.6`, so they still show up in rounds.
- With "Show weak words more often" on, each word gets a random draw weighted by `0.2 + 2 × weakness`. Weak words tend to come first, but the order remains unpredictable.
- Drilling a specific set (weakest, unseen or missed words) uses only those words, in random order.

## Data storage and backup

All data is saved automatically in the browser's `localStorage` under the key `vocabdrill.v1`. It stays on your device and is never uploaded.

Because a single HTML file cannot write files to disk by itself, backups use copy and paste:

- **Show backup (JSON)** displays the full data. Copy it and keep it in a file.
- **Restore from JSON** replaces the current data with pasted backup text.

Structure of the JSON:

```json
{
  "decks": {
    "My deck": {
      "name": "My deck",
      "colA": "Korean",
      "colB": "English",
      "words": [
        { "k": "항목|Item", "a": "항목", "b": "Item",
          "s": { "n": 4, "c": 3, "t": 21.5, "last": 1730000000000 },
          "fs": { "d": 1730000000000, "i": 6, "e": 2.5, "r": 5, "l": 1, "h": 2 } }
      ]
    }
  },
  "sessions": [ { "id": "My deck", "date": 1730000000000, "n": 20, "ok": 16, "score": 12450 } ],
  "pastes":   [ { "date": 1730000000000, "deck": "Pasted words", "n": 5, "added": 4, "words": [ { "a": "항목", "b": "Item" } ] } ],
  "cfg":      { "dir": "mix", "n": 20, "cards": 20, "sec": 15, "focus": true }
}
```

`s` holds a word's quiz stats: `n` = tries, `c` = correct answers, `t` = total seconds spent, `last` = time of the last answer (`null` until the word is answered for the first time).

`fs` holds a word's flashcard schedule: `d` = due time (ms), `i` = interval in days (0 = learning), `e` = ease, `r` = number of reviews, `l` = number of times graded Again, `h` = number of times graded Hard. Both are permanent and are not reset by later Good/Easy grades. A word without `fs` is a new card.

Notes:

- Clearing the browser's site data deletes the saved data, so take a backup first.
- Data is per browser and per page address. Use the backup to move it to another device or browser.
- Deleting a deck also deletes that deck's round history.
- Paste history keeps every entry in the data, and the home screen shows the latest 20.

## Dependencies

Runtime: Vue 3, plus Express, `pg` and `bcryptjs` for the optional member backend.
Build tooling: Vite + `@vitejs/plugin-vue` (see `package.json` / `package-lock.json`).
The built static bundle works offline for the drills; the Member page needs the backend. The home screen
loads Google Fonts (Bricolage Grotesque, Noto Sans, Noto Sans KR); without a network connection,
the system font fallbacks are used.

## Project layout

```
index.html             # Vite entry: mount point + no-flash theme bootstrap + fonts
vite.config.js         # Vite config with the Vue plugin
package.json            # scripts: dev / build / preview / verify
src/
  main.js              # createApp(App).mount('#app')
  style.css            # global styles (light/dark, responsive, cards, quiz, flashcards)
  store.js             # reactive db, localStorage, and pure logic helpers
  useTheme.js          # reactive light/dark theme state
  App.vue              # screen state machine: home / quiz / review / analytics
  components/
    HomeView.vue       # decks, paste import, settings, history, backup
    QuizView.vue       # round logic, options, timer, scoring
    ReviewView.vue     # spaced-repetition flashcards
    AnalyticsView.vue  # weakness ranking and targeted drills
    ThemeToggle.vue    # theme button
   api.js             # fetch wrapper (cookies + CSRF header, offline-safe)
   LoginView.vue      # sign-in form for the protected page
   MemberView.vue     # protected page: session status + logout
server/
   config.js          # fail-fast env validation and cookie/CORS settings
   auth.js            # bcrypt verification and HMAC-SHA256 signed sessions
   db.js              # pg.Pool
   index.js           # Express: /api/health, /api/login, /api/logout, /api/me
scripts/
   hash-pw.mjs        # user-run password hashing
   db-migrate.mjs     # creates the users table
   seed-user.mjs      # creates/updates the login user
tests/                 # node:test checks (auth, config, HTTP server, optional DB)
Vocab Drill.html       # legacy single-file reference (kept for comparison; not the product)
backup/                # pre-redesign copies
```

Each screen is a Vue single-file component with a `/* ---------- <Section> ---------- */` marker.
Shared state and pure helpers (weakness, shuffle, parsing, scheduling previews) live in `src/store.js`.

## Known limitations

- No typing mode: quiz answers are multiple choice, and flashcard grades are self-assessed.
- Each word has a single accepted answer. A meaning like `Required/Essential` is one answer string.
- Pasted words always go to the "Pasted words" deck.
- No single-word editing or deleting. To remove words, restore an edited backup.
- Data is not synced between devices. Use the JSON backup.
- The Member session token is self-contained: logging out clears the browser cookie but does not
  revoke a copied token before its 24-hour expiry. A password change should be followed by rotating
  `VD_SESSION_SECRET`. There is no built-in rate limiting on `/api/login` — add it at the edge if
  the backend is exposed publicly.

## Ideas for later

- A real `.json` file download and upload when run locally.
- Typing mode and multiple accepted meanings per word.
- Choosing the target deck when pasting.
- Deleting a single paste or word.
- SQLite storage (for example through a small backend) if the data grows large.
