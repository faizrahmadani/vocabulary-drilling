# Vocab Drill
This repository contains AI generated code. Please do keep in mind that this project serves solely as a platform for language vocabulary drilling.

A Kahoot-style vocabulary quiz for memorizing and revising a language (built around Korean ↔ English, but it works for any two-column word list). Everything lives in a single HTML file: no server, no build step, no database to install.


## Features

- **Kahoot-style rounds**: the question sits at the top, with four colored answer buttons below.
- **Excel import**: load `.xlsx`, `.xls` or `.csv` files. Row 1 is the header, and every row below is one word pair.
- **Paste import**: copy two columns from Excel or Sheets (no header) and press **Paste from clipboard**.
- **Unpredictable order**: every round is freshly shuffled, and each word appears at most once per round.
- **Weak-word focus**: optionally show the words you struggle with more often (the order stays random).
- **Analytics**: a per-deck ranking of the words that need more practice, plus round history.
- **Targeted drills**: drill your 20 weakest words, 20 unseen words, or the words you just missed.
- **Automatic saving**: results, decks and paste history are stored in the browser, with a JSON backup you can copy and restore.
- **Light and dark mode**: follows the system setting. Works on desktop and mobile.

## Quick start

1. Open `vocab-drill.html` in a modern browser (Chrome, Edge, Firefox, Safari). No installation is needed.
2. Import a word list (see below).
3. Choose your round settings and press **Play**.

An internet connection is needed the first time the page loads, because the Excel reader library is loaded from a CDN (see [Dependencies](#dependencies)).

## Word list format

### Excel / CSV file

| Korean | English |
|---|---|
| 항목 | Item |
| 필수 | Required/Essential |

- The first row is the header. The two header names become the deck's column names.
- Only the first two columns of the first sheet are read.
- Rows with an empty cell, and duplicate pairs, are skipped.
- A deck needs at least **4 valid word pairs**.
- The deck is named after the file name. Importing a file with the same name again updates that deck and **keeps your stats** for words that are still in it.

### Pasted text

Copy rows **without a header**, for example:

```
항목	Item
필수	Required/Essential
```

Each line is split on the first separator found, checked in this order: tab, `;`, `|`, ` - `, `,`. Excel and Sheets copy as tab-separated text, so no extra work is needed. Surrounding quotes are removed.

- Pasted words go into a deck called **Pasted words** (columns Korean / English). Duplicates are skipped.
- Every paste is saved immediately and listed under **Paste history** on the home screen (date and time, rows pasted, how many were new, and the words themselves).
- If the browser blocks direct clipboard access, a text box appears. Paste into it with Ctrl+V (or long-press and Paste on a phone) and the words are added right away.

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
          "s": { "n": 4, "c": 3, "t": 21.5, "last": 1730000000000 } }
      ]
    }
  },
  "sessions": [ { "id": "My deck", "date": 1730000000000, "n": 20, "ok": 16, "score": 12450 } ],
  "pastes":   [ { "date": 1730000000000, "deck": "Pasted words", "n": 5, "added": 4, "words": [ { "a": "항목", "b": "Item" } ] } ],
  "cfg":      { "dir": "mix", "n": 20, "sec": 15, "focus": true }
}
```

`s` holds a word's stats: `n` = tries, `c` = correct answers, `t` = total seconds spent, `last` = time of the last answer (`null` until the word is answered for the first time).

Notes:

- Clearing the browser's site data deletes the saved data, so take a backup first.
- Data is per browser and per page address. Use the backup to move it to another device or browser.
- Deleting a deck also deletes that deck's round history.
- Paste history keeps every entry in the data, and the home screen shows the latest 20.

## Dependencies

- [SheetJS](https://sheetjs.com/) 0.18.5, loaded from `cdnjs.cloudflare.com`, for reading Excel files.

To use the app fully offline, download that script and reference it locally in the `<script src>` tag at the top of the HTML file.

## Project layout

```
vocab-drill.html   # the whole app: HTML + CSS + JavaScript
README.md
```

Inside the HTML file the script is split into three parts: **Home** (import, decks, settings, paste history, backup), **Quiz** (round logic and scoring) and **Analytics** (ranking and drills).

## Known limitations

- Multiple-choice only. There is no typing mode yet.
- Each word has a single accepted answer. A meaning like `Required/Essential` is one answer string.
- Pasted words always go to the "Pasted words" deck.
- No single-word editing or deleting. To remove words, re-import a corrected file under a new name, or restore an edited backup.
- Data is not synced between devices. Use the JSON backup.

## Ideas for later

- A real `.json` file download and upload when run locally.
- Typing mode and multiple accepted meanings per word.
- Choosing the target deck when pasting.
- Deleting a single paste or word.
- SQLite storage (for example through a small backend) if the data grows large.
