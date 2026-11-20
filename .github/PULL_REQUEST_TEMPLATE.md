<!--
PR body convention (AGENTS.md): a reader must understand the change without opening the diff.
Fill in ALL THREE required parts. Delete this comment before submitting.
-->

## 1. What changed

<!-- 1–2 sentences. A fix states the user-visible symptom + root cause.
     A feature states what it does and for whom. Not a file list. -->

## 2. AS IS → TO BE

<!-- Show the modified flow explicitly so it can be traced end-to-end from this section alone.
     Use prose arrows for a simple change, a small diagram when branches matter. -->

**AS IS:**

**TO BE:**

## 3. Gate report

<!-- Record the real results. Do not hide failures; do not invent metrics. -->

- **Red-team subagent:** <!-- general-purpose agent used; paste its written report summary here -->
  - Attacked:
  - Survived:
  - Real weaknesses found and fixed (or "none found"):
- **Verification run (once, after red-team):** `node scripts/verify.mjs "Vocab Drill.html"` → <!-- pass/fail + counts -->
- **Manual browser smoke test:** <!-- platforms/viewports/themes checked, or "not a user-journey change" -->
- **Docs updated in this PR:** <!-- links to README.md / docs/ / docs/specs/ files, or "N/A — no user-journey change" -->
- **Known holes / documented gaps:** <!-- e.g. no unit framework, no mutation testing; see AGENTS.md §10 -->
- **Unrelated full-suite failures:** <!-- none, or list them here -->

---

- [ ] Branch created from latest `main`; `main` not touched directly
- [ ] Atomic commits with `type(scope):` messages; explicit paths staged only
- [ ] Verification run exactly once, after the red-team report
- [ ] Definition of Done (AGENTS.md §8) fully satisfied
