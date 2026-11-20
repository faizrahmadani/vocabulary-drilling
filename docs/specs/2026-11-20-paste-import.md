# Paste / import word list

## Status / surface

Current behavior as of 2026-11-20. Surface: **Home** screen (`/* ---------- Home ---------- */`
in `Vocab Drill.html`), functions `parsePaste()` and `addPasted()`.

## AS IS

1. On the Home screen the user copies two headerless columns from Excel or Sheets and clicks
   **Paste from clipboard**.
2. If the browser grants clipboard access, the text is read directly and parsed immediately.
3. If clipboard access is blocked, a textbox appears; the user pastes with Ctrl+V (or
   long-press → Paste on mobile) and the words are added immediately as well.
4. Each line is split on the **first** separator found, in this order: tab, `;`, `|`,
   ` - `, `,`. Surrounding quotes are stripped.
5. Exact duplicate `column 1 + column 2` pairs are skipped. The status line and **Paste
   history** report how many rows were pasted and how many were new.
6. Words go into the deck named **Pasted words** (columns Korean / English) and are saved
   to `localStorage['vocabdrill.v1']` right away.
7. Every paste is recorded in **Paste history** on Home (date/time, rows pasted, new count,
   the words themselves). The trash button clears the history after confirmation; deck words
   and statistics are unaffected. Home shows the latest 20 entries.
8. A deck needs at least 4 word pairs for quiz rounds; flashcards work with fewer.

### Error / edge cases

- Empty or separator-only input → nothing added; status reflects 0 rows.
- Fewer than 4 pairs → flashcards work, quiz rounds are unavailable.
- Duplicate pairs → skipped and counted; no duplicate word identity (`k = a|b`).
- Any separator in the precedence list is accepted; the first one wins.

## Invariants

- `a|b` is the word identity key; duplicates are never inserted twice.
- All pasted words land in the **Pasted words** deck.
- Paste history keeps every entry; only the display is capped at 20.
- Data stays in the browser; no network call is made by the import flow.
- Clearing paste history never deletes deck words or statistics.

## Related

- [`../../README.md`](../../README.md) — "Word list format", "Data storage and backup".
- [`../README.md`](../README.md) — data model and operations.
- [`../TESTING.md`](../TESTING.md) — paste-import happy/error/edge cases.
