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
| Product artifact | Vue 3 + Vite SPA: `index.html` + `src/` → static bundle in `dist/` |
| `<module-test-cmd>` / `<ui-test-cmd>` / `<e2e-cmd>` | `npm run verify` = `node scripts/verify.mjs` (structural smoke) + `vite build` (compile gate) + `npm test` (`node:test`: `tests/api.test.js`). No DOM/E2E runner — **documented partial gap**, see §10. |
| `<mutation-tool>` | **Not available** — no mutation tool configured for the project. Documented gap, see §10. |
| `<docs-dir>` | `docs/` (architecture + operations) |
| `<spec-dir>` | `docs/specs/` (user-journey specs) |
| `<lockfile>` | `package-lock.json` — npm, committed. `npm install` before any command. |
| `<lint-cmd>` / `<format-cmd>` | `npm run verify` for structural/compile checks; manual style check against §3 conventions. No ESLint/Prettier config by design. |
| `<temp-dir-helper>` | **N/A** — no file-writing code. Browser state lives in `localStorage` (`vocabdrill.v1`). |
| Browser storage key | `vocabdrill.v1` (all decks, stats, schedules, sessions, pastes, config) |
| Member backend | **Separate repository** `NodeRed-On-Vercel`: Node-RED + Postgres + bcrypt + HMAC cookie `nr_session`. It answers `/api/login`, `/api/logout`, `/api/me`. This repo is frontend-only: local Vite proxy `/api` → `127.0.0.1:1880`; production uses explicit CORS on the backend. |
| Runtime dependencies | `vue` only. `node-red`, `pg`, `bcryptjs`, `express` are all absent by design. Drill screens still work without the backend. |
| Secrets | **None in this repository.** No `.env`, no `.env.example`, no DB URL, no API key, no session secret. The only build-time variable is public `VITE_API_BASE`; credentials are created by the user in the backend repository; agents never ask for or store passwords. |

Commands assume PowerShell on Windows and run from the repository root. Requires Node.js 22+
and npm. `Vocab Drill.html` is kept only as the legacy single-file reference the Vue app was
ported from; it is **not** a build input or verification gate. `Redesign 참조/vocab-drill-redesign.html`
is a static design mock, likewise not a product artifact or gate.

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
  surface needs corresponding verification. "Layers" are the Vue components in §3.1; add
  checks to `scripts/verify.mjs` or a documented manual case for each changed behavior.
- **Test scoping (default: changed area only).** Unless the user explicitly asks for
  everything, verify only what the change touches. The gate is cheap enough for the whole
  project. Run it after the red-team reports and get **one clean green run** gating the PR.
  If it fails, fix the cause and re-run, recording each run; re-run again after any rebase or
  PR-modifying push. Never re-run without a fix.

  ```powershell
  npm run verify
  ```

  This runs `node scripts/verify.mjs` (structure) then `vite build` (compile). Legacy
  `Vocab Drill.html` and `Redesign 참조/vocab-drill-redesign.html` are reference/design files,
  not products or gates (see §0).

- **Conventions for any test code added to this project:**
  - Pure logic: keep testable helpers in `src/store.js` and import/assert them directly.
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
- **Platform prerequisites:** Node.js 22+ and npm are required to install dependencies and
  run the Vite dev/build/verify commands; the built static app needs only a modern browser.
  Document any new OS/toolchain prerequisite here rather than silently working around it.
  External tools: prefer the real thing when available, fall back to a controlled fake so
  checks pass offline.

### 3.1 Architecture map (orientation only — line numbers drift)

The product is a Vue 3 + Vite SPA with these regions:

| Region | Where | Responsibility |
|---|---|---|
| Head / theme bootstrap | `index.html` inline `<script>` | Applies saved theme before paint to avoid flash. |
| Entry / styles | `src/main.js`, `src/style.css` | Mounts the app; global light/dark + responsive CSS. |
| Core state | `src/store.js` — `db`, `save()`, `replaceDb()`, `weak()` | Reactive `localStorage` store and pure logic helpers. |
| Screen machine | `src/App.vue` | One view mounted at a time; navigation events. |
| **Home** | `src/components/HomeView.vue` — `/* ---------- Home ---------- */` | Deck list, settings, clipboard/paste import, paste history, JSON backup/restore. |
| **Quiz** | `src/components/QuizView.vue` — `/* ---------- Quiz ---------- */` | Round selection, weighted shuffle, options, scoring, timer, finish. |
| **Flashcards** | `src/components/ReviewView.vue` — `/* ---------- Flashcards ---------- */` | Due queue, draw/reveal, `rate()`, ease/interval scheduling, session summary. |
| **Analytics** | `src/components/AnalyticsView.vue` — `/* ---------- Analytics ---------- */` | Weakness ranking, "ever Again or Hard", targeted drills. |
| **Member** | `src/components/MemberView.vue`, `LoginView.vue`, `src/api.js` — `/* ---------- Member (protected page) ---------- */`, `/* ---------- Login ---------- */` | Protected page: `GET /api/me`, sign-in form, logout. Only this screen requires a session. |
| **Auth boundary** | `src/api.js` | `credentials:'include'`, `x-requested-with`, JSON body, offline-safe result. Calls `/api/login`, `/api/logout`, `/api/me` on the separate backend. |
| **Backend (other repo)** | `NodeRed-On-Vercel` → `data/settings.js` | `httpNodeAuth` answers login/logout/me and guards the rest of `/api`; Postgres + bcrypt + HMAC sessions. Never edited from this repository. |

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
  coverage on the four screen components.

---

## 8. Definition of Done (all boxes required before PR)

- [ ] Change is on a short-lived branch created from latest `main`; `main` untouched.
- [ ] Test/check written first for new behavior; production code satisfies it.
- [ ] Mandatory general-purpose red-team subagent ran and produced a written report.
- [ ] Red-team checks/fixes merged; real bugs fixed; no assertion weakened.
- [ ] Scoped verification run **once** after red-team: `npm run verify` passes.
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
  approval. Approved here: Vue/Vite toolchain only. The auth backend is a separate repository and
  is NOT a dependency of this project. The built static app still works offline with system font
  fallbacks.

---

## 10. Documented gaps (honest, not hidden)

These playbook items do not apply cleanly to a Vue/Vite frontend-only app. They are recorded
here rather than faked:

| Playbook item | Status | Compensation |
|---|---|---|
| Unit-test framework / 1:1 test LOC | **Partial.** `scripts/verify.mjs` (structural smoke) + `vite build` (compile); no runner for game logic. Helpers now live in importable `src/store.js`, so a runner can be added later. | Add a check per changed behavior; manual browser smoke cases documented in `docs/TESTING.md`. |
| Mutation testing | **Not available.** No mutation tool configured. | Explicit edge-case checks (§3), higher branch coverage on the four screen components; never invent a score. |
| E2E framework | **Not available.** | Manual role-based browser smoke tests for every user-journey change. |
| Lint / format configs | **N/A.** No ESLint/Prettier config by design. | Style conventions in §3; `npm run verify` for structural/compile checks. |
| `.env.example` / secrets | **N/A.** No server, no secrets. | All state is local in `localStorage`. |
| Temp dirs / fixtures | **N/A.** App writes no files. | Reset state via a fresh `db` or cleared `localStorage['vocabdrill.v1']`. |
| CI / auto-merge / API token | **Not configured.** | Agent reports the compare URL and stops; the human creates and merges the PR. |
| DOM/E2E runner for Member UI | **Not available.** | `tests/api.test.js` checks the fetch wrapper; the HTTP/auth contract is tested in `NodeRed-On-Vercel`. Member UI is covered by manual browser smoke in `docs/TESTING.md`. |
| `TEST_DATABASE_URL` | **Backend repo only.** | The backend's `tests/auth-db.test.js` is skipped without it; agents never invent a connection string. |
| Cross-origin production | **Separate deployments.** | Backend must set `NODE_RED_FRONTEND_ORIGIN` + `NODE_RED_COOKIE_SAMESITE=None` over HTTPS. Locally the Vite proxy avoids CORS entirely. |
| Session revocation / rate limiting | **By design / edge concern.** | The self-contained backend token remains valid until `exp` after logout; rotate `NODE_RED_SESSION_SECRET` after a compromise. Add rate limiting at the edge for a public deployment. |

---

## 11. Quick command reference

```powershell
# Install once, then develop / build / preview
npm install
npm run dev
npm run build
npm run preview

# Member backend lives in the separate NodeRed-On-Vercel repo (port 1880).
# Run `npm run dev` there; this repo proxies /api to it. No .env or DB here.

# Verify the product (after red-team, exactly once before PR): structure + compile + tests
npm run verify

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
