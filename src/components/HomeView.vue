<script setup>
/* ---------- Home ---------- */
import { computed, ref } from 'vue'
import { db, save, replaceDb, acc, deckDue, clamp, parsePaste } from '../store.js'
import ThemeToggle from './ThemeToggle.vue'

const emit = defineEmits(['play', 'review', 'stats', 'member'])

const msg = ref('')
const fallbackPaste = ref(false)
const fallbackText = ref('')
const demoFlipped = ref(false)
const backupMode = ref('') // '' | 'export' | 'import'
const backupText = ref('')
const restoreText = ref('')

const decks = computed(() => Object.keys(db.decks).map((id) => {
  const d = db.decks[id]
  const a = acc(d)
  const du = deckDue(d)
  const n = Math.min(du.due + du.fresh, db.cfg.cards > 0 ? db.cfg.cards : Infinity)
  return { id, name: d.name, wordCount: d.words.length, colA: d.colA, colB: d.colB,
    acc: a, due: du.due, fresh: du.fresh, n }
}))
const history = computed(() => db.pastes.slice(-20).reverse())

function patchCfg(key, value) { db.cfg[key] = value; save() }
function setDir(v) { patchCfg('dir', v) }
function setNum(k, e) {
  const v = clamp(+e.target.value || 0, 0, 500)
  e.target.value = v
  patchCfg(k, v)
}
function step(k, delta) { patchCfg(k, clamp((db.cfg[k] || 0) + delta, 0, 500)) }
function setSec(e) { patchCfg('sec', clamp(+e.target.value, 3, 60)) }
function setFocus(e) { patchCfg('focus', e.target.checked) }

function addPasted(text) {
  const rows = parsePaste(text)
  if (!rows.length) {
    msg.value = 'Nothing to add. Copy rows with two columns (Korean, English) and try again.'
    return
  }
  const name = 'Pasted words'
  const d = db.decks[name] = db.decks[name] || { name, colA: 'Korean', colB: 'English', words: [] }
  const have = new Set(d.words.map((w) => w.k))
  let added = 0
  rows.forEach((r) => {
    const k = r.a + '|' + r.b
    if (!have.has(k)) { have.add(k); d.words.push({ k, a: r.a, b: r.b, s: null }); added++ }
  })
  db.pastes.push({ date: Date.now(), deck: name, n: rows.length, added, words: rows })
  save()
  fallbackPaste.value = false
  fallbackText.value = ''
  const skipped = rows.length - added
  msg.value = `Pasted ${rows.length} rows: ${added} new` +
    (skipped ? `, ${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : '') +
    `. “${name}” now has ${d.words.length} unique word${d.words.length === 1 ? '' : 's'}.` +
    (d.words.length < 4 ? ` Add ${4 - d.words.length} more words to play this deck.` : '')
}

async function pasteFromClipboard() {
  try {
    addPasted(await navigator.clipboard.readText())
  } catch (e) {
    fallbackPaste.value = true
  }
}
function onFallbackPaste() {
  // Let the browser finish inserting the pasted text before reading it.
  setTimeout(() => addPasted(fallbackText.value), 0)
}

function delDeck(id) {
  if (!confirm('Delete this deck and its history?')) return
  delete db.decks[id]
  db.sessions = db.sessions.filter((s) => s.id !== id)
  save()
}
function clearPastes() {
  if (!confirm('Clear all paste history? Deck words and stats stay. This cannot be undone.')) return
  db.pastes = []
  save()
}
function showBackup() { backupMode.value = 'export'; backupText.value = JSON.stringify(db) }
function showRestore() { backupMode.value = 'import'; restoreText.value = '' }
function doRestore() {
  try {
    const data = JSON.parse(restoreText.value)
    if (!data || !data.decks) throw new Error('invalid backup')
    replaceDb(data)
    backupMode.value = ''
    msg.value = 'Backup restored.'
  } catch (e) {
    alert('That text is not a valid backup.')
  }
}
</script>

<template>
  <div class="home">
    <header class="rd-hero">
      <div>
        <div class="rd-title-row">
          <h1>Vocab Drill</h1>
          <div class="rd-title-actions">
            <button class="btn btn-ghost" type="button" @click="emit('member')">Member</button>
            <ThemeToggle />
          </div>
        </div>
        <p class="rd-lead">Paste a word list, review it as spaced-repetition flashcards, play quick rounds, then see which words still need work.</p>
        <div class="rd-paste-row">
          <button id="paste" class="btn btn-primary" type="button" @click="pasteFromClipboard">Paste from clipboard</button>
          <span class="rd-hint">Copy rows of two columns (Korean, English) without a header, then press Paste.</span>
        </div>
        <div v-if="fallbackPaste" class="rd-status">
          <div class="card">
            <p class="mut">The browser did not allow direct clipboard access. Paste into the box below (Ctrl+V, or long-press and Paste); the words are added right away.</p>
            <textarea id="pt" v-model="fallbackText" placeholder="One pair per line: Korean, English" @paste="onFallbackPaste"></textarea>
            <div class="row"><button id="pgo" type="button" @click="addPasted(fallbackText)">Add words</button></div>
          </div>
        </div>
        <p id="msg" class="rd-status">{{ msg }}</p>
      </div>
      <div class="rd-card-wrap">
        <button class="rd-flash" :class="{ flipped: demoFlipped }" type="button" aria-label="Flip example card" @click="demoFlipped = !demoFlipped">
          <span class="rd-face rd-front"><span class="rd-word">단어</span><span class="rd-tiny">Tap to flip</span></span>
          <span class="rd-face rd-back"><span class="rd-word">word</span><span class="rd-tiny">단어</span></span>
        </button>
      </div>
    </header>

    <section class="rd-sec">
      <div class="rd-sec-head"><h2>Your decks</h2><span>{{ decks.length ? decks.length + ' deck' + (decks.length === 1 ? '' : 's') : '' }}</span></div>
      <div v-if="decks.length" class="rd-decks">
        <article v-for="deck in decks" :key="deck.id" class="rd-deck">
          <div class="rd-deck-top"><b>{{ deck.name }}</b><small>{{ deck.wordCount }} words</small></div>
          <div class="rd-deck-meta">{{ deck.colA }} ↔ {{ deck.colB }} · {{ deck.due }} due · {{ deck.fresh }} new<br>{{ deck.acc === null ? 'Not played yet' : deck.acc + '% correct' }}</div>
          <div class="rd-meter" title="Accuracy"><i :style="{ width: (deck.acc || 0) + '%' }"></i></div>
          <div class="rd-deck-btns">
            <button class="btn btn-primary" type="button" @click="emit('play', deck.id)">Play</button>
            <button class="btn btn-ghost" type="button" @click="emit('review', deck.id)">Review{{ deck.n ? ' (' + deck.n + ')' : '' }}</button>
            <button class="btn btn-ghost" type="button" @click="emit('stats', deck.id)">Analytics</button>
            <button class="btn btn-danger" type="button" @click="delDeck(deck.id)">Delete</button>
          </div>
        </article>
      </div>
      <div v-else class="rd-empty">No decks yet. Paste a word list to start.</div>
    </section>

    <section class="rd-sec">
      <div class="rd-sec-head"><h2>Round settings</h2></div>
      <div class="rd-panel">
        <div class="rd-row">
          <div class="rd-lbl">Direction</div>
          <div class="rd-seg" role="group" aria-label="Direction">
            <button v-for="v in [{ v: 'mix', t: 'Mixed' }, { v: 'ab', t: 'Column 1 → 2' }, { v: 'ba', t: 'Column 2 → 1' }]"
                    :key="v.v" type="button" :aria-pressed="db.cfg.dir === v.v" @click="setDir(v.v)">{{ v.t }}</button>
          </div>
        </div>
        <div class="rd-row">
          <div class="rd-lbl">Questions<small>0 = all words</small></div>
          <div class="rd-step">
            <button type="button" aria-label="Decrease questions" @click="step('n', -5)">−</button>
            <input id="n" type="number" min="0" max="500" aria-label="Questions" :value="db.cfg.n" @change="setNum('n', $event)">
            <button type="button" aria-label="Increase questions" @click="step('n', 5)">+</button>
          </div>
        </div>
        <div class="rd-row">
          <div class="rd-lbl">Review cards<small>0 = all cards</small></div>
          <div class="rd-step">
            <button type="button" aria-label="Decrease review cards" @click="step('cards', -5)">−</button>
            <input id="cards" type="number" min="0" max="500" aria-label="Review cards" :value="db.cfg.cards" @change="setNum('cards', $event)">
            <button type="button" aria-label="Increase review cards" @click="step('cards', 5)">+</button>
          </div>
        </div>
        <div class="rd-row">
          <label for="sec">Seconds per question</label>
          <div class="rd-range">
            <input id="sec" type="range" min="3" max="60" step="1" :value="db.cfg.sec" @input="setSec($event)">
            <output id="secOut">{{ db.cfg.sec }}</output>
          </div>
        </div>
        <div class="rd-row">
          <label for="focus">Show weak words more often<small>Words you miss appear more often</small></label>
          <div class="rd-switch"><input id="focus" type="checkbox" :checked="db.cfg.focus" @change="setFocus($event)"><span></span></div>
        </div>
      </div>
    </section>

    <section class="rd-sec">
      <div class="rd-sec-head">
        <h2>Paste history</h2>
        <button v-if="db.pastes.length" id="clrpast" class="iconbtn" type="button" title="Clear paste history" aria-label="Clear paste history" @click="clearPastes">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v7M14 10v7"/></svg>
        </button>
      </div>
      <div v-if="db.pastes.length" class="rd-history">
        <details v-for="(p, i) in history" :key="p.date + '-' + i">
          <summary>
            <b>{{ new Date(p.date).toLocaleString() }}</b>
            <span>{{ p.n }} rows · {{ p.added }} new<template v-if="p.n > p.added"> · {{ p.n - p.added }} duplicate{{ p.n - p.added === 1 ? '' : 's' }}</template> → {{ p.deck }}</span>
          </summary>
          <div class="tbl rd-history-body"><table><tr v-for="(w, j) in p.words" :key="j"><td>{{ w.a }}</td><td>{{ w.b }}</td></tr></table></div>
        </details>
      </div>
      <div v-else class="rd-empty">Nothing pasted yet.</div>
    </section>

    <section class="rd-sec">
      <div class="rd-sec-head"><h2>Backup</h2></div>
      <div class="rd-backup">
        <button class="btn btn-ghost" type="button" @click="showBackup">Show backup (JSON)</button>
        <button class="btn btn-ghost" type="button" @click="showRestore">Restore from JSON</button>
        <div id="bk">
          <template v-if="backupMode === 'export'">
            <p class="mut">Copy this text and keep it somewhere safe.</p>
            <textarea id="t" v-model="backupText" readonly @focus="$event.target.select()"></textarea>
          </template>
          <template v-else-if="backupMode === 'import'">
            <p class="mut">Paste a backup here. It replaces the current data.</p>
            <textarea id="t" v-model="restoreText"></textarea>
            <button type="button" @click="doRestore">Restore</button>
          </template>
        </div>
      </div>
    </section>
  </div>
</template>
