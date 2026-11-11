# Vocab Drill
This repository contains AI generated code. Please do keep in mind that this project serves solely as a platform for language vocabulary drilling.

A Kahoot-style vocabulary quiz for memorizing and revising a language (built around Korean ↔ English, but it works for any two-column word list). Everything lives in a single HTML file: no server, no build step, no database to install.


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

## Quick start

1. Open `vocab-drill.html` in a modern browser (Chrome, Edge, Firefox, Safari). No installation is needed.
2. Paste a word list (see below).
3. Choose your round settings and press **Play**.

## Word list format

Copy rows **without a header**, for example:

```
항목	Item
필수	Required/Essential
```

Each line is split on the first separator found, checked in this order: tab, `;`, `|`, ` - `, `,`. Excel and Sheets copy as tab-separated text, so no extra work is needed. Surrounding quotes are removed.

- Pasted words go into a deck called **Pasted words** (columns Korean / English). Duplicates are skipped.
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

The app has no JavaScript dependencies and still works offline. The redesigned home loads Google Fonts (Bricolage Grotesque, Noto Sans, Noto Sans KR); without a network connection, the system font fallbacks are used.

## Project layout

```
Vocab Drill.html   # the whole app: HTML + CSS + JavaScript
README.md
backup/            # pre-redesign copies
```

Inside the HTML file the script is split into four parts: **Home** (paste import, decks, settings, paste history, backup), **Quiz** (round logic and scoring), **Flashcards** (spaced-repetition scheduling) and **Analytics** (ranking and drills).

## Known limitations

- No typing mode: quiz answers are multiple choice, and flashcard grades are self-assessed.
- Each word has a single accepted answer. A meaning like `Required/Essential` is one answer string.
- Pasted words always go to the "Pasted words" deck.
- No single-word editing or deleting. To remove words, restore an edited backup.
- Data is not synced between devices. Use the JSON backup.

## Ideas for later

- A real `.json` file download and upload when run locally.
- Typing mode and multiple accepted meanings per word.
- Choosing the target deck when pasting.
- Deleting a single paste or word.
- SQLite storage (for example through a small backend) if the data grows large.
