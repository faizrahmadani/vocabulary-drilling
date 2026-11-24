#!/usr/bin/env node
/**
 * Zero-dependency structural smoke check for the Vue 3 + Vite Vocab Drill app.
 *
 * This is NOT a unit-test framework and NOT a substitute for browser testing.
 * It fails fast with a descriptive message when the project scaffold, the Vue
 * single-file components, or the documented data contract are broken.
 * The compile gate is `vite build` and the behavioral gate is `npm test`, both
 * run by `npm run verify` after this script. This repository is frontend-only:
 * the auth API lives in the separate NodeRed-On-Vercel repository.
 *
 * Usage (from the repository root):
 *   node scripts/verify.mjs
 *   npm run verify          # this script + vite build + npm test
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
  for (const script of ['dev', 'build', 'preview', 'verify', 'test']) {
    check(`package.json has the ${script} script`, typeof pkg.scripts?.[script] === 'string');
  }
  for (const script of ['server', 'hash-pw', 'db:migrate', 'seed-user']) {
    check(`package.json has no ${script} script (backend lives in another repo)`,
      typeof pkg.scripts?.[script] === 'undefined');
  }
  check('declares Vue as the only runtime dependency',
    Object.keys(pkg.dependencies ?? {}).join(',') === 'vue');
  for (const dep of ['node-red', 'pg', 'bcryptjs', 'express']) {
    check(`package.json has no backend dependency ${dep}`,
      !(pkg.dependencies?.[dep] || pkg.devDependencies?.[dep]));
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
  'src/api.js',
  'src/components/LoginView.vue',
  'src/components/MemberView.vue',
  'tests/api.test.js',
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
  'src/components/ReviewView.vue', 'src/components/AnalyticsView.vue', 'src/components/ThemeToggle.vue',
  'src/components/LoginView.vue', 'src/components/MemberView.vue'];
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

// --- Auth gate boundary ------------------------------------------------------
const appSource = read('src/App.vue') ?? '';
const apiSource = read('src/api.js') ?? '';
const gitignore = read('.gitignore') ?? '';
check('App.vue has a member screen and keeps the four original screens',
  appSource.includes("'member'") && appSource.includes("'home'")
  && appSource.includes("'quiz'") && appSource.includes("'review'")
  && appSource.includes("'analytics'"));
check('api wrapper sends cookies and the CSRF header',
  apiSource.includes("credentials: 'include'") && apiSource.includes('x-requested-with'));
check('.env is gitignored so credentials stay local', /(^|\n)\.env(\r?\n|$)/.test(gitignore));
check('no backend directory remains in this frontend-only repo',
  !fs.existsSync(path.join(root, 'data')) && !fs.existsSync(path.join(root, 'server')));
check('.env.example is not shipped (the frontend needs no environment variables)',
  !fs.existsSync(path.join(root, '.env.example')));

const viteSource = read('vite.config.js') ?? '';
check('Vite proxies /api to the separate Node-RED backend on port 1880',
  viteSource.includes("'/api'") && viteSource.includes('http://127.0.0.1:1880'));
check('preview uses the same proxy so the built app can call the API',
  /preview\s*:\s*\{[\s\S]*?proxy/.test(viteSource));

// No database URL, secret or API key may ever reach the browser bundle.
const frontendSources = ['index.html', 'src/main.js', 'src/store.js', 'src/api.js', 'src/useTheme.js',
  ...vueFiles].map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
for (const forbidden of ['DATABASE_URL', 'SESSION_SECRET', 'CREDENTIAL_SECRET', 'x-api-key', 'NODE_RED_']) {
  check(`frontend source has no ${forbidden}`, !frontendSources.includes(forbidden));
}
check('production API routing is configured via the public VITE_API_BASE',
  apiSource.includes('VITE_API_BASE') && apiSource.includes('apiUrl(path)'),
  'relative /api paths only work with the dev proxy');
check('spec names the backend cookie nr_session, not the old vd_session',
  /nr_session/.test(read('docs/specs/2026-11-24-member-login.md') ?? '')
  && !/vd_session/.test(read('docs/specs/2026-11-24-member-login.md') ?? ''));
check('manual test docs do not tell this repo to run backend scripts',
  !/npm run (server|hash-pw|db:migrate|seed-user)/.test(read('docs/TESTING.md') ?? ''));

console.log(`\n${passed} passed, ${failures} failed.`);
if (failures > 0) {
  console.error('Verification FAILED. Fix the cause before committing.');
  process.exit(1);
}
console.log('Structural verification OK (npm run verify also compiles with vite build).');
