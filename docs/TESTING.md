# Testing & verification strategy

This document is the honest record of what can and cannot be verified in this project.
It supports `AGENTS.md` §3, §7, §10. **Nothing here is a fabricated metric.**

## 1. Current harness

| Layer | Mechanism | Command | Status |
|---|---|---|---|
| Artifact syntax/structure | `scripts/verify.mjs` (zero dependencies, Node 22+) | `node scripts/verify.mjs "Vocab Drill.html"` | Reference check — **partial gap** |
| Game logic (quiz, SRS, weakness, parsing) | No unit-test runner; JS is inline in the HTML | — | **Gap** — see §4 |
| UI / state stores | Manual browser smoke test | see §3 | **Gap** — no component runner |
| E2E | Manual, role-based locators / user-visible assertions | see §3 | **Gap** — no E2E framework |
| Mutation testing | None available for inline browser JS | — | **Gap** — never invent a score |

`scripts/verify.mjs` fails fast with descriptive messages when: the artifact cannot be read,
the doctype/charset/viewport/mount point are missing, the documented storage key or the four
architecture section markers are absent, an inline `<script>` block has a `SyntaxError`, or
script tags are unbalanced. It **compiles but never executes** the scripts.

Run it **once, after the red-team subagent reports**, not before and not in a loop
(`AGENTS.md` §1, §5, §6). It is cheap enough to scope to the whole single-file artifact.
To check another artifact: `node scripts/verify.mjs "Redesign 참조/vocab-drill-redesign.html"`.

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

## 3. Manual browser smoke procedure

For any user-journey change (`AGENTS.md` §4):

1. Open the file in Chrome/Edge **and** Firefox or Safari if available.
2. Check desktop width and a narrow mobile width.
3. Check light, dark, and system theme (reload to verify no flash and persistence).
4. Walk the affected journey end-to-end using the cases in §2.
5. Open DevTools console — there must be no new uncaught errors.
6. Test offline once (devtools offline / no network) to confirm font fallback.
7. Record exactly what was checked in the PR gate report.

## 4. Documented gaps — how we compensate

- **No unit framework.** Inline JS cannot be imported by a runner. Compensate with explicit
  edge-case manual cases above and the structural check. If the user ever approves extracting
  JS into modules, add a real runner here and raise the bar.
- **No mutation testing.** No tool exists for inline browser JS. Compensate with higher
  branch coverage on the four sections. Never report a mutation score.
- **No E2E framework.** Compensate with the role-based manual smoke procedure.
- **No lockfile / lint / format config.** Zero dependencies by design. Keep style consistent
  with the existing file; `node scripts/verify.mjs` catches structural regressions only.
- **No temp-dir/fixture strategy needed.** The app writes no files. Isolate state with a fresh
  browser profile or by clearing only `localStorage['vocabdrill.v1']`.

A documented gap is better than a hidden one. If a check is flaky or skipped on a platform,
name it and the reason here — never delete it to get a green run.
