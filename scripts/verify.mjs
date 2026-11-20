#!/usr/bin/env node
/**
 * Zero-dependency smoke/syntax check for the single-file Vocab Drill app.
 *
 * This is NOT a unit-test framework and NOT a substitute for browser testing.
 * It is the project's "reference check": it fails fast with a descriptive
 * message when the HTML artifact is structurally broken or its inline scripts
 * do not parse. See docs/TESTING.md and AGENTS.md §10 for documented gaps.
 *
 * Usage (from the repository root):
 *   node scripts/verify.mjs "Vocab Drill.html"
 *
 * The redesign reference is a STATIC DESIGN MOCK, not a product artifact. It is
 * intentionally not a gate and will fail these product checks by design.
 *
 * Exit codes: 0 = all checks passed, 1 = at least one check failed.
 */

import fs from 'node:fs';
import vm from 'node:vm';

const target = process.argv[2] ?? 'Vocab Drill.html';
const label = process.argv.slice(2).join(' ') || target;

let failures = 0;
let passed = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log(`Verifying: ${label}`);

let html;
try {
  html = fs.readFileSync(target, 'utf8');
  check('artifact exists and is readable', true);
} catch (err) {
  check('artifact exists and is readable', false, err.message);
  console.error('\n1 check failed. Aborting.');
  process.exit(1);
}

// --- Structural checks (the "happy path" of the artifact) -------------------
check('starts with an HTML doctype', /^\s*<!DOCTYPE html>/i.test(html));
check('declares a UTF-8 charset', /<meta\s+charset=["']?utf-8["']?/i.test(html));
check('declares a responsive viewport', /<meta\s+name=["']viewport["']/i.test(html));
check('has a single app mount point', (html.match(/<div\s+id=["']app["']\s*><\/div>/g) ?? []).length === 1);
check('uses the documented storage key', html.includes('vocabdrill.v1'));
check('loads the Google Fonts stylesheet', (html.match(/fonts\.googleapis\.com/g) ?? []).length >= 1);

// The four logical sections are the architecture map in AGENTS.md §3.1.
// Require the dashed marker INSIDE a block comment — a string literal is not enough.
const comments = [...html.matchAll(/\/\*([\s\S]*?)\*\//g)].map((m) => m[1]);
for (const section of ['Home', 'Quiz', 'Flashcards', 'Analytics']) {
  check(`contains the ${section} section marker`,
    comments.some((c) => new RegExp(`-{2,}\\s*${section}\\b`).test(c)));
}

// --- Inline script syntax checks (error + boundary cases) -------------------
// Compile only — never execute. DOM globals are irrelevant at this stage.
const allOpenTags = html.match(/<script\b[^>]*>/gi) ?? [];
const externalTags = allOpenTags.filter((tag) => /\bsrc\s*=/.test(tag));
check('no external script src (offline-by-design policy)', externalTags.length === 0,
  externalTags.join(', '));

const scriptBlocks = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter((match) => !/\bsrc\s*=/.test(match[1]));

check('has at least one inline script block', scriptBlocks.length > 0);
check('all inline script blocks were found', scriptBlocks.length === allOpenTags.length - externalTags.length,
  `${scriptBlocks.length} compiled / ${allOpenTags.length - externalTags.length} inline tags`);

scriptBlocks.forEach((match, index) => {
  try {
    new vm.Script(match[2], { filename: `${label}#inline-script-${index + 1}` });
    check(`inline script #${index + 1} parses without SyntaxError`, true);
  } catch (err) {
    check(`inline script #${index + 1} parses without SyntaxError`, false, err.message);
  }
});

// --- Cheap boundary checks --------------------------------------------------
// Catch both the playbook's double-angle tokens and the single-angle placeholders
// used in AGENTS.md (e.g. <default-branch>), without matching ordinary HTML tags.
const placeholders = /<<[A-Za-z-]+>>|<(?:default-branch|git-host|docs-dir|spec-dir|module-test-cmd|ui-test-cmd|e2e-cmd|mutation-tool|lint-cmd|format-cmd|temp-dir-helper|angle-bracket)>/;
check('does not contain an unresolved placeholder', !placeholders.test(html));

const openCount = (html.match(/<script\b/gi) ?? []).length;
const closeCount = (html.match(/<\/script\s*>/gi) ?? []).length;
check('script tags are balanced', openCount === closeCount,
  `${openCount} opening vs ${closeCount} closing tags`);

console.log(`\n${passed} passed, ${failures} failed.`);
if (failures > 0) {
  console.error('Verification FAILED. Fix the cause before committing.');
  process.exit(1);
}
console.log('Verification OK (syntax + structure only — still run the browser smoke test).');
