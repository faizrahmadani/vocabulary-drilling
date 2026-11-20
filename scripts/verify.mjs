#!/usr/bin/env node
/**
 * Zero-dependency structural smoke check for the Vue 3 + Vite Vocab Drill app.
 *
 * This is NOT a unit-test framework and NOT a substitute for browser testing.
 * It fails fast with a descriptive message when the project scaffold, the Vue
 * single-file components, or the documented data contract are broken.
 * The real compile gate is `vite build`, run by `npm run verify` after this script.
 *
 * Usage (from the repository root):
 *   node scripts/verify.mjs
 *   npm run verify          # this script + vite build
 *
 * Exit codes: 0 = all checks passed, 1 = at least one check failed.
 */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let passed = 0;
let failures = 0;

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const read = (rel) => {
  try {
    return fs.readFileSync(path.join(root, rel), 'utf8');
  } catch (err) {
    check(`${rel} exists and is readable`, false, err.message);
    return null;
  }
};

console.log('Verifying Vocab Drill (Vue 3 + Vite) project structure');

// --- Entry artifact ---------------------------------------------------------
const html = read('index.html');
if (html !== null) {
  check('index.html starts with an HTML doctype', /^\s*<!DOCTYPE html>/i.test(html));
  check('index.html declares a UTF-8 charset', /<meta\s+charset=["']?utf-8["']?/i.test(html));
  check('index.html declares a responsive viewport', /<meta\s+name=["']viewport["']/i.test(html));
  check('index.html has a single app mount point',
    (html.match(/<div\s+id=["']app["']\s*><\/div>/g) ?? []).length === 1);
  check('index.html keeps the no-flash theme bootstrap', html.includes('vocabdrill.theme'));
  check('index.html loads the Google Fonts stylesheet',
    (html.match(/fonts\.googleapis\.com/g) ?? []).length >= 1);
  check('index.html mounts the Vite module entry',
    /<script\s+type=["']module["']\s+src=["']\/src\/main\.js["']><\/script>/.test(html));
  const external = (html.match(/<script\b[^>]*\bsrc\s*=/gi) ?? [])
    .filter((tag) => !/type=["']module["']/.test(tag));
  check('no non-module external script src (offline-by-design policy)', external.length === 0,
    external.join(', '));
  const open = (html.match(/<script\b/gi) ?? []).length;
  const close = (html.match(/<\/script\s*>/gi) ?? []).length;
  check('script tags are balanced', open === close, `${open} opening vs ${close} closing tags`);
}

// --- Package manifest -------------------------------------------------------
let pkg = null;
const pkgRaw = read('package.json');
if (pkgRaw !== null) {
  try { pkg = JSON.parse(pkgRaw); } catch (e) { check('package.json is valid JSON', false, e.message); }
}
if (pkg) {
  check('package.json is valid JSON', true);
  check('declares Vue 3 as a runtime dependency', /^[\^~]?3\./.test(pkg.dependencies?.vue ?? ''));
  check('declares Vite as a dev dependency', Boolean(pkg.devDependencies?.vite));
  check('declares @vitejs/plugin-vue', Boolean(pkg.devDependencies?.['@vitejs/plugin-vue']));
  for (const script of ['dev', 'build', 'preview', 'verify']) {
    check(`package.json has the ${script} script`, typeof pkg.scripts?.[script] === 'string');
  }
  check('uses ES modules ("type": "module")', pkg.type === 'module');
}

// --- Source tree ------------------------------------------------------------
for (const rel of [
  'vite.config.js',
  'src/main.js',
  'src/style.css',
  'src/store.js',
  'src/useTheme.js',
  'src/App.vue',
  'src/components/HomeView.vue',
  'src/components/QuizView.vue',
  'src/components/ReviewView.vue',
  'src/components/AnalyticsView.vue',
  'src/components/ThemeToggle.vue',
]) read(rel);

const main = read('src/main.js');
if (main !== null) {
  check('main.js creates and mounts the Vue app',
    /createApp\(App\)\.mount\(['"]#app['"]\)/.test(main));
  check('main.js imports the global stylesheet', /import\s+['"]\.\/style\.css['"]/.test(main));
}

const store = read('src/store.js');
if (store !== null) {
  check('store uses the documented storage key', store.includes('vocabdrill.v1'));
  for (const symbol of ['reactive', 'export function save', 'export function replaceDb',
    'export const weak', 'export function parsePaste', 'export const deckDue']) {
    check(`store.js defines ${symbol}`, store.includes(symbol));
  }
}

// The four logical sections from the architecture map live in their own components.
const sources = ['src/store.js', 'src/components/HomeView.vue', 'src/components/QuizView.vue',
  'src/components/ReviewView.vue', 'src/components/AnalyticsView.vue']
  .map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
for (const section of ['Home', 'Quiz', 'Flashcards', 'Analytics']) {
  check(`contains the ${section} section marker`,
    new RegExp(`-{2,}\\s*${section}\\b`).test(sources));
}

// --- Vue SFC structure ------------------------------------------------------
const vueFiles = ['src/App.vue', 'src/components/HomeView.vue', 'src/components/QuizView.vue',
  'src/components/ReviewView.vue', 'src/components/AnalyticsView.vue', 'src/components/ThemeToggle.vue'];
for (const rel of vueFiles) {
  const sfc = read(rel);
  if (sfc === null) continue;
  const opensTemplate = (sfc.match(/<template[\s>]/g) ?? []).length;
  const closesTemplate = (sfc.match(/<\/template>/g) ?? []).length;
  check(`${rel}: template tags balanced`, opensTemplate === closesTemplate,
    `${opensTemplate} vs ${closesTemplate}`);
  check(`${rel}: has a <script setup> block`, /<script\s+setup\s*>/.test(sfc));
  check(`${rel}: script tags balanced`,
    (sfc.match(/<script\b/g) ?? []).length === (sfc.match(/<\/script>/g) ?? []).length);
}

// --- Boundary checks --------------------------------------------------------
const placeholders = /<<[A-Za-z-]+>>|<(?:default-branch|git-host|docs-dir|spec-dir|module-test-cmd|ui-test-cmd|e2e-cmd|mutation-tool|lint-cmd|format-cmd|temp-dir-helper|angle-bracket)>/;
const allText = [html, pkgRaw, ...vueFiles.map((f) => fs.readFileSync(path.join(root, f), 'utf8'))]
  .filter(Boolean).join('\n');
check('does not contain an unresolved placeholder', !placeholders.test(allText));

console.log(`\n${passed} passed, ${failures} failed.`);
if (failures > 0) {
  console.error('Verification FAILED. Fix the cause before committing.');
  process.exit(1);
}
console.log('Structural verification OK (npm run verify also compiles with vite build).');
