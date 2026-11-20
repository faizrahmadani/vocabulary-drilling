# AGENTS.md — Vocab Drill

> **Contract for AI agents working in this repository. Read this before making any change.**
>
> Adapted from *The Language-Agnostic AI Agent Playbook* (Portable Engineering Guide v1.0,
> 19 November 2026). The workflow in Parts 1–7 is **fixed**. The values in the tables below
> are the project-specific fill-ins for the playbook's `<angle-bracket>` placeholders.

---

## 0. Project facts — the filled placeholders

| Playbook placeholder | Value for this repository |
|---|---|
| `<default-branch>` | `main` (protected by convention) |
| `<git-host>` | GitHub — `https://github.com/faizrahmadani/vocabulary-drilling.git` |
| Product artifact | `Vocab Drill.html` — the entire app (HTML + CSS + JS), no build step |
| `<module-test-cmd>` / `<ui-test-cmd>` / `<e2e-cmd>` | `node scripts/verify.mjs "Vocab Drill.html"` (zero-dependency smoke/syntax check). This is a **documented partial gap** — see §10. |
| `<mutation-tool>` | **Not available** — no mutation tool for inline browser JS in a single-file app. Documented gap, see §10. |
| `<docs-dir>` | `docs/` (architecture + operations) |
| `<spec-dir>` | `docs/specs/` (user-journey specs) |
| `<lockfile>` | **N/A** — zero runtime dependencies, no package manifest, no install step. |
| `<lint-cmd>` / `<format-cmd>` | `node scripts/verify.mjs` for structural checks; manual style check against §3 conventions. No ESLint/Prettier config by design. |
| `<temp-dir-helper>` | **N/A** — no file-writing code. Browser state lives in `localStorage` (`vocabdrill.v1`). |
| Browser storage key | `vocabdrill.v1` (all decks, stats, schedules, sessions, pastes, config) |

Commands assume PowerShell on Windows and run from the repository root. Quote the HTML
filename everywhere — it contains a space. `Redesign 참조/vocab-drill-redesign.html` is a
static design mock, **not** a product artifact: it is deliberately not a verification gate
and will fail these checks by design.

---

## 1. PR-first delivery boundary (mandatory)

After implementing a requested change, run the red-team subagent first (§6), then the
applicable verification until one clean green run gates the PR (§3), and **stop at the PR
boundary** (report the compare URL; the human creates and merges the PR):

1. Work on a short-lived feature/fix branch, never directly on `main`.
2. Review and stage only the intended files (`git status`, `git diff`; stage explicit paths).
3. Commit and push the branch.
4. Report the GitHub compare URL for the human to open the PR, and verify the pushed head SHA.
   With no CI/token configured, the human creates **and** merges the PR.
5. **Stop and report the compare URL + head SHA.** Do not deploy, merge, close, or continue
   with unrelated cleanup.

Record focused verification results and any unrelated failures in the PR description instead
of hiding them or proceeding to deployment. Use the three-part PR body template in
`.github/PULL_REQUEST_TEMPLATE.md`.

---

## 2. Commit hygiene and branch rules (mandatory)

- **Always commit; land every change through a PR; never push straight to `main`.** This
  includes one-line and "urgent" fixes. No exceptions.
- **Commit as soon as a feature is verified.** Commit gate = implemented + red-team done +
  a green scoped verification run. Verification runs **only after** the red-team has
  completed. If it fails, fix the cause and re-run until green, recording each run; never
  re-run without a fix.
- **Branches only; no worktrees.** Branch from the latest `main` in the primary tree.
- Keep `main` fast-forward only: `git fetch` + `git pull --ff-only`, never a direct push.
- **Stage explicit paths only.** Never `git add -A`, never stash, never revert files you did
  not write. In a tree edited by concurrent agents, inspect `git status` / `git diff` and
  stage exactly the intended files. The pre-existing working-tree changes are the user's —
  do not include them in your commits.
- **Atomic commits:** one coherent change per commit (one feature slice, one bugfix, or its
  corresponding docs/tests). Commit multiple independent units separately in dependency
  order, each verified.
- Commit messages: `feat(<scope>): …`, `fix(<scope>): …`, `test(<scope>): …`, `docs(<scope>): …`.
- **Rebase, never force `main`.** If the branch is behind, rebase onto the current base and
  resolve conflicts intentionally. After a PR is created or a push modifies it: fetch base,
  verify mergeability, rebase if conflicted, re-run scoped checks, `git diff --check`, push
  with `--force-with-lease` (never plain `--force`), then re-verify mergeability and head SHA.

Typical flow (replace branch name; human merges):

```powershell
git checkout -b feat/<short-slug> origin/main
# ... all work here; stage explicit paths; run red-team then verify ...
git push -u origin feat/<short-slug>
# ... open PR from the compare URL, verify it, then STOP ...
```

After merge, clean up: `git checkout main; git pull --ff-only; git branch -d feat/<short-slug>`.

---

## 3. Testing requirements

- **Enforce a 1:1 test-to-code ratio across layers.** Every new or modified production
  surface needs corresponding verification. In this single-file app, "layers" are the script
  sections in §3.1; add checks to `scripts/verify.mjs` or a documented manual case for each
  changed behavior.
- **Test scoping (default: changed area only).** Unless the user explicitly asks for
  everything, verify only what the change touches. Here the whole app is one file, so the
  scoped command is cheap. Run it after the red-team reports and get **one clean green run**
  gating the PR. If it fails, fix the cause and re-run, recording each run; re-run again after
  any rebase or PR-modifying push. Never re-run without a fix.

  ```powershell
  node scripts/verify.mjs "Vocab Drill.html"
  ```

  Do **not** run this against `Redesign 참조/vocab-drill-redesign.html` as a gate — that file
  is a static design mock and fails these product checks by design (see §0).

- **Conventions for any test code added to this project:**
  - Pure logic: extract testable helpers where practical, then import/assert them directly.
    Keep helpers in the same HTML file unless the user approves splitting the app.
  - State isolation: reset via the app's own API / a fresh `db` object — never by reloading
    modules. For browser runs, use a fresh profile or clear only `localStorage['vocabdrill.v1']`.
  - UI: assert on user-visible text/roles, not implementation details; use role-based
    locators for any future E2E.
  - Network boundary: stub Google Fonts / clipboard at the boundary if a future test runner
    is introduced. Offline behavior is a required case (system font fallbacks).
  - Temporary state: no shared fixed paths; the app writes no files.
  - Assertions must be **fail-fast with descriptive messages** — never soft assertions.
  - Coverage: happy path, error paths, and edge cases (empty input, `null`, boundary values:
    3 vs 4 word pairs, `0` questions = all, timer limits 3–60, ease clamps 1.3–3.0).
- **Platform prerequisites:** Node.js 22+ is used only by `scripts/verify.mjs`; the app itself
  needs only a modern browser. Document any new OS/toolchain prerequisite here rather than
  silently working around it. External tools: prefer the real thing when available, fall
  back to a controlled fake so checks pass offline.

### 3.1 Architecture map (orientation only — line numbers drift)

`Vocab Drill.html` is one document with these regions:

| Region | Where | Responsibility |
|---|---|---|
| Head / theme bootstrap | top of file, `<script>` before `<style>` | Applies saved theme before paint to avoid flash. |
| CSS variables + responsive/light/dark styles | `<style>` block | All styling; no external stylesheet except Google Fonts. |
| Markup shell | `<div id="app"></div>` | Single mount point; screens are rendered into it. |
| Core state | `KEY`, `$`, `app`, `load()`, `save()`, `weak()` | `localStorage` persistence and weakness scoring. |
| **Home** | `/* ---------- Home ---------- */` | Deck list, settings, clipboard/paste import, paste history, JSON backup/restore. |
| **Quiz** | `/* ---------- Quiz ---------- */` | Round selection, weighted shuffle, options, scoring, timer, finish. |
| **Flashcards** | `/* ---------- Flashcards (spaced repetition) ---------- */` | Due queue, draw/reveal, `rate()`, ease/interval scheduling, session summary. |
| **Analytics** | `/* ---------- Analytics ---------- */` | Weakness ranking, "ever Again or Hard", targeted drills. |

Data model and operations are documented in `docs/README.md`. User-journey specs live in
`docs/specs/`; update the matching spec in the same PR when a journey changes.

---

## 4. Documentation as a deliverable (mandatory)

Any change that alters what a user sees, clicks, or experiences — new screens/flows,
navigation, form fields, status labels, error messages, accessibility, mobile behavior,
theme behavior — **must** include a docs update in the same PR. This is checked at PR time.

- If a spec covering the changed surface exists in `docs/specs/`, update it in that PR.
- If none exists, create one named `YYYY-MM-DD-<topic>.md` using the template in
  `docs/specs/README.md`.
- Update `README.md` and/or `docs/README.md` for changed behavior, data shape, or commands.
- Include the doc files in the same commit/PR as the code.

Stale docs are an incomplete change: agents and humans rely on them as the source of truth.

---

## 5. Ordered workflow when adding new code (mandatory order)

1. **Write the test/check first** for the new or changed behavior. Do not run it yet.
2. Write the production code to satisfy it.
3. **Run the mandatory red-team subagent** (§6).
4. **Only after the red-team is done**, run the scoped verification and get **one clean green
   run**. If it fails, fix the cause (feature checks + red-team checks) and re-run, recording
   each run; then stop at the PR. Never re-run without a fix.
5. If mutation testing were feasible, run it and document the score. Here it is not (§10) —
   document the gap and compensate with explicit edge-case cases.
6. **Never modify production code just to make a test pass** — fix the test or the real bug.

---

## 6. Mandatory red-team subagent (mandatory)

Before any feature branch is pushed, spawn a **general-purpose** red-team subagent — not a
read-only explorer — to actively try to break the feature:

1. Give it the full diff/branch context and the exact production code paths involved
   (`Home`, `Quiz`, `Flashcards`, `Analytics`, `load`/`save`, `weak`).
2. Instruct it to hunt, in this order:
   - **Concurrency / races:** double-clicks, duplicate submissions, rapid grade taps, late
     timers firing after navigation, stale `R`/`Q` state, paste handler firing twice.
   - **State-machine transitions:** every quiz/flashcard status combination; re-entrancy;
     cancel / retry / replay / switch deck while in flight; Again repeating within a session.
   - **Security:** path/filename issues in backup restore, malformed or hostile pasted text,
     JSON with wrong types/huge arrays, HTML injection through deck names or word text,
     `localStorage` quota errors.
   - **Error paths:** corrupt `vocabdrill.v1`, clipboard denied, offline font load, timer
     edge values, decks with fewer than 4 words, empty/duplicate paste, `null` stats.
   - **Durability:** interrupted save, quota-exceeded writes, backup round-trip fidelity,
     theme persistence, restore overwriting existing data without confirmation.
3. Require a **written report**: what was attacked, what survived, and for each genuine
   weakness either a failing check reproducing it or a bug fix + check. The red-team does not
   need to run the checks — the main agent does. **Never let the subagent weaken or skip
   assertions to make tests pass; a real bug must be fixed.**
4. Merge the red-team's produced checks/fixes into the branch. The main agent then runs the
   full scoped set (red-team's + feature's) **once**, after the report — never before.
5. Record findings, including fixed bugs, in the PR description. Prefer integration-style
   verification (real browser behavior, real `localStorage` round-trip) over mocks. If nothing
   is found, say so explicitly rather than padding with low-value checks.
6. **Fallback when no subagent tool exists:** the main agent performs this exact attack in a
   separate, clearly labelled pass and records it as "red-team fallback (main agent)" in the
   PR gate report. Never silently skip the gate because the tool is unavailable. The hunt
   order and reporting requirements above are unchanged.

---

## 7. Coverage and mutation metrics

- Track check LOC vs production LOC and report the real ratio; do not game it.
- Record mutation scores per module with a rationale for low scores. Conservative targets:
  ≥80% for small focused modules, ≥40% for large ones (>500 lines).
- For this project, mutation testing is unavailable — report it as a documented gap (§10),
  not a fabricated score. Compensate with explicit edge-case checks and higher branch
  coverage on the four script sections.

---

## 8. Definition of Done (all boxes required before PR)

- [ ] Change is on a short-lived branch created from latest `main`; `main` untouched.
- [ ] Test/check written first for new behavior; production code satisfies it.
- [ ] Mandatory general-purpose red-team subagent ran and produced a written report.
- [ ] Red-team checks/fixes merged; real bugs fixed; no assertion weakened.
- [ ] Scoped verification run **once** after red-team: `node scripts/verify.mjs "Vocab Drill.html"` passes.
- [ ] Manual browser smoke test for any user-journey change (desktop + mobile width, light + dark).
- [ ] Docs updated in the same PR (`README.md`, `docs/`, and `docs/specs/` as applicable).
- [ ] Commits are atomic, explicit-path staged, and use `type(scope):` messages.
- [ ] PR body contains all three parts (thing itself, AS IS → TO BE, gate report).
- [ ] PR URL/number and final head SHA verified; then work stops (human merges).

---

## 9. Explicit boundaries — never do these

- Never push directly to `main`; never merge, deploy, redeploy, or close the PR yourself.
- Never do unrelated cleanup after PR creation.
- Never work in a worktree; never `git add -A`, stash, or revert files you did not write.
- Never run the full verification suite in a loop or before the red-team reports.
- Never hide a failing/flaky check, delete it, or skip assertions to get green.
- Never invent a coverage or mutation number; document gaps instead.
- Never bundle unrelated features, cleanup, docs, and tests into one commit.
- Never add runtime dependencies/build tooling or network requirements without explicit user
  approval — "no build step, works offline" is a product property.

---

## 10. Documented gaps (honest, not hidden)

These playbook items do not apply cleanly to a zero-dependency, single-HTML-file app. They are
recorded here rather than faked:

| Playbook item | Status | Compensation |
|---|---|---|
| Unit-test framework / 1:1 test LOC | **Partial.** Only `scripts/verify.mjs` (syntax + structural smoke). No runner for game logic because the JS is inline. | Add a check per changed behavior; manual browser smoke cases documented in `docs/TESTING.md`. Revisit if the user approves extracting JS into modules. |
| Mutation testing | **Not available.** No inline-browser-JS mutation tool. | Explicit edge-case checks (§3), higher branch coverage on the four sections; never invent a score. |
| E2E framework | **Not available.** | Manual role-based browser smoke tests for every user-journey change. |
| Lockfile / lint / format configs | **N/A.** No packages to pin. | Style conventions in §3; `node scripts/verify.mjs` for structural checks. |
| `.env.example` / secrets | **N/A.** No server, no secrets. | All state is local in `localStorage`. |
| Temp dirs / fixtures | **N/A.** App writes no files. | Reset state via a fresh `db` or cleared `localStorage['vocabdrill.v1']`. |
| CI / auto-merge / API token | **Not configured.** | Agent reports the compare URL and stops; the human creates and merges the PR. |

---

## 11. Quick command reference

```powershell
# Verify the artifact (after red-team, exactly once before PR)
node scripts/verify.mjs "Vocab Drill.html"

# Verify an alternate HTML artifact
node scripts/verify.mjs "Redesign 참조/vocab-drill-redesign.html"

# Git hygiene
git status
git diff --check
git checkout -b feat/<short-slug> origin/main
git add <explicit paths>
git commit -m "feat(<scope>): ..."
git push -u origin feat/<short-slug>
```

**Bottom line:** branch first, attack your own work before anyone else does, test only what
changed and only once after the attack, commit in small reviewable units, write the docs,
open the PR, and stop.
