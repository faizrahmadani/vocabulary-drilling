# User-journey specs

Each file here describes one user-visible journey so a reader can understand current
behavior without opening the HTML diff. When a change alters a user journey, update the
matching spec **in the same PR** (`AGENTS.md` §4); if none exists, create one.

## Naming

`YYYY-MM-DD-<topic>.md`, lowercase kebab-case topic. Example: `2026-11-20-paste-import.md`.
The date is the day the spec was first written, not the day it was last edited.

## Required structure

```markdown
# <Journey name>

## Status / surface
<!-- current state, which screen(s), which section(s) of Vocab Drill.html -->

## AS IS
<!-- The current end-to-end flow: steps a user takes and what the app does/shows.
     Include the happy path, error paths, and important edge cases. -->

## TO BE (only in the PR that changes it)
<!-- When changing this journey, replace/extend the AS IS section with the new
     behavior and keep a short AS IS → TO BE summary for the reviewer. -->

## Invariants
<!-- What must remain true (e.g. "no word appears twice in a round",
     "localStorage key stays vocabdrill.v1", "works offline"). -->

## Related
<!-- Links to README.md sections, docs/TESTING.md cases, and affected script sections. -->
```

## Index

- [2026-11-20 — Paste / import word list](2026-11-20-paste-import.md)
- [2026-11-24 — Member login (protected page)](2026-11-24-member-login.md)

User-facing feature documentation: [`../../README.md`](../../README.md).
Architecture and data model: [`../README.md`](../README.md).
