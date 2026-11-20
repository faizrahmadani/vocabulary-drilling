# Vocab Drill — architecture & operations

High-level reference for agents and humans. User-facing documentation lives in
[`../README.md`](../README.md); user-journey behavior specs live in [`specs/`](specs/).
The agent workflow contract lives in [`../AGENTS.md`](../AGENTS.md).

## 1. What the system is

A Kahoot-style + Anki-style vocabulary drill. Everything is in a single static file,
`Vocab Drill.html`: HTML, CSS, and vanilla JavaScript. There is no server, no build step,
no package manifest, no runtime dependency, and no network requirement (Google Fonts are
progressive enhancement with system fallbacks).

The only persistence is browser `localStorage` under the key `vocabdrill.v1`. Backups are
copy/paste JSON because a `file://` page cannot write to disk.

## 2. Architecture map

`Vocab Drill.html` has one mount point, `<div id="app"></div>`, and renders screens into it.
Line numbers drift — use the section comment markers to navigate.

| Region | Marker / symbols | Responsibility |
|---|---|---|
| Theme bootstrap | inline `<script>` in `<head>` | Reads `vocabdrill.theme` before first paint to avoid a light/dark flash. |
| Styling | `<style>` | CSS variables for light/dark, responsive layout, card/option styles, redesign classes. |
| Shell | `<div id="app"></div>` | Single render target for Home, Quiz, Flashcards, Analytics. |
| Core state | `KEY`, `$`, `app`, `load()`, `save()`, `weak()` | Load/save the `db` object; smoothed weakness score used for weighting and ranking. |
| Home | `/* ---------- Home ---------- */` | Deck list and settings, paste import (`parsePaste`, `addPasted`), paste history, JSON backup/restore, theme toggle. |
| Quiz | `/* ---------- Quiz ---------- */` | `start`, `ask`, `pick`, `next`, `finish`. Weighted shuffle, 4 options, timer, score/streak, missed words. |
| Flashcards | `/* ---------- Flashcards (spaced repetition) ---------- */` | `deckDue`, `review`, `drawCard`, `reveal`, `rate`, `finishReview`. Due queue, ease/interval scheduling, session summary. |
| Analytics | `/* ---------- Analytics ---------- */` | `stats`. Weakness ranking, "ever graded Again or Hard", targeted drills. |

### Data flow

```
Excel/Sheets paste → parsePaste → addPasted → db.decks[...].words → save()
        ↓
   Home (deck list) → Quiz (weighted draw, timer, score) ─┐
                    → Review (due queue, grade → fs)      ├→ save() → stats/analytics → drills
                                                          ┘
   Backup (JSON string) ←→ db ←→ Restore (JSON string)
```

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

- **Run:** open `Vocab Drill.html` in a modern browser. No install, no server.
- **Import:** copy two headerless columns from Excel/Sheets → **Paste from clipboard**.
  Separator precedence: tab, `;`, `|`, ` - `, `,`. Exact `a + b` duplicates are skipped.
  A deck needs ≥4 pairs for quiz rounds; flashcards work with fewer.
- **Back up:** Home → **Show backup (JSON)** → copy the text into a file.
- **Restore:** Home → **Restore from JSON** → paste the saved text (replaces current data).
- **Move devices:** data is per browser and per page address; use the JSON backup.
- **Reset test state:** clear only `localStorage['vocabdrill.v1']` (and `vocabdrill.theme`
  for theme) in a throwaway browser profile. Never clear the user's real profile.
- **Verify a change:** `node scripts/verify.mjs "Vocab Drill.html"`, then a manual browser
  smoke test. See [TESTING.md](TESTING.md).

## 5. Known limitations / gotchas

- No typing mode; one accepted answer string per word.
- Pasted words always go to the "Pasted words" deck.
- No single-word edit/delete — restore an edited backup instead.
- No cross-device sync; JSON backup is the transfer mechanism.
- Clearing site data deletes saved data — back up first.
- Deleting a deck also deletes its round history. Paste history keeps all entries (home
  shows the latest 20).
- Google Fonts require network; without it the system font stack is used.
- Restore accepts arbitrary JSON from the clipboard: malformed shapes must be handled
  defensively (`load()` already wraps parsing in `try/catch`). Any change here is a
  red-team priority — see `AGENTS.md` §6.
