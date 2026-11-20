<script setup>
/* ---------- Flashcards (spaced repetition) ---------- */
import { reactive, ref, computed, onMounted, onUnmounted } from 'vue'
import { db, save, shuffle, deckDue, fmtWait, previews, copyPairs, MIN, DAY } from '../store.js'

const props = defineProps({ deckId: { type: String, default: null } })
const emit = defineEmits(['home', 'stats', 'play'])

const GRADES = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' }
const GRADE_KEYS = { again: 1, hard: 2, good: 3, easy: 4 }

const blank = () => ({
  id: null, list: [], i: 0, total: 0, seen: {},
  g: { again: 0, hard: 0, good: 0, easy: 0 },
  trouble: {}, reveal: false, w: null, q: '', ans: '', front: '', back: '', p: {},
})
const R = reactive(blank())
const phase = ref('draw') // 'draw' | 'caught' | 'done'
const summary = ref(null)
const caught = ref(null)
const seenCount = computed(() => Object.keys(R.seen).length)

function review(id = props.deckId) {
  const d = db.decks[id]
  if (!d) { emit('home'); return }
  const now = Date.now()
  const due = d.words.filter((w) => w.fs && w.fs.r && w.fs.d <= now)
  const fresh = d.words.filter((w) => !w.fs || !w.fs.r)
  const limit = db.cfg.cards > 0 ? db.cfg.cards : Infinity
  const list = shuffle(due).concat(shuffle(fresh)).slice(0, limit)
  Object.assign(R, blank(), { id, list, total: list.length })
  if (!list.length) { caughtUp(id); return }
  phase.value = 'draw'
  drawCard()
}

function caughtUp(id) {
  const d = db.decks[id]
  const later = d.words.filter((w) => w.fs && w.fs.r).map((w) => w.fs.d)
  const nx = later.length ? Math.min(...later) : null
  caught.value = {
    id, name: d.name,
    text: nx ? 'Next card ' + fmtWait(nx - Date.now()) + '.' : 'No cards scheduled yet.',
  }
  phase.value = 'caught'
}

function drawCard() {
  if (R.i >= R.list.length) return finishReview()
  const d = db.decks[R.id], w = R.list[R.i], c = db.cfg
  const f = c.dir === 'mix' ? Math.random() < 0.5 : c.dir === 'ab'
  R.w = w
  R.q = f ? w.a : w.b
  R.ans = f ? w.b : w.a
  R.front = f ? d.colA : d.colB
  R.back = f ? d.colB : d.colA
  R.p = previews(w)
}

function reveal() { if (phase.value === 'draw' && !R.reveal) R.reveal = true }

function rate(g) {
  if (phase.value !== 'draw' || !R.reveal) return
  const w = R.w, c = w.fs = w.fs || { d: 0, i: 0, e: 2.5, r: 0, l: 0 }, now = Date.now()
  const bad = () => (R.trouble[w.k] || (R.trouble[w.k] = { w, again: 0, hard: 0 }))
  if (g === 'again') { c.e = Math.max(1.3, c.e - 0.2); c.i = 0; c.l++; c.d = now + MIN; R.list.push(w); bad().again++ }
  else if (g === 'hard') { c.e = Math.max(1.3, c.e - 0.15); c.h = (c.h || 0) + 1; if (!c.i) { c.d = now + 10 * MIN } else { c.i = Math.max(1, Math.round(c.i * 1.2)); c.d = now + c.i * DAY } bad().hard++ }
  else if (g === 'good') { if (!c.i) { c.i = 1; c.d = now + DAY } else { c.i = Math.max(1, Math.round(c.i * c.e)); c.d = now + c.i * DAY } }
  else { c.e = Math.min(3, c.e + 0.15); c.i = c.i ? Math.max(2, Math.round(c.i * c.e * 1.3)) : 3; c.d = now + c.i * DAY }
  c.r++
  R.seen[w.k] = true
  R.g[g]++
  save()
  R.i++
  R.reveal = false
  drawCard()
}

function finishReview() {
  if (phase.value === 'done') return
  if (!seenCount.value) { emit('home'); return }
  const id = R.id
  const du = deckDue(db.decks[id])
  summary.value = {
    id, name: db.decks[id].name, seen: seenCount.value, g: { ...R.g },
    remaining: du.due + du.fresh, bad: Object.values(R.trouble), cardsLimit: db.cfg.cards,
  }
  phase.value = 'done'
}

function copyBad() { copyPairs(summary.value.bad.map((x) => x.w)) }

function onKey(e) {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return
  if (phase.value !== 'draw') return
  if (!R.reveal && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); reveal(); return }
  if (R.reveal && '1234'.includes(e.key)) { e.preventDefault(); rate(['again', 'hard', 'good', 'easy'][+e.key - 1]) }
}

onMounted(() => { window.addEventListener('keydown', onKey); review() })
onUnmounted(() => { window.removeEventListener('keydown', onKey) })
</script>

<template>
  <div v-if="phase === 'caught' && caught" class="rev">
    <div class="revbar"><span>{{ caught.name }}</span><button class="ghost" type="button" @click="emit('home')">Home</button></div>
    <h1 style="margin-top:28px">All caught up</h1>
    <p class="mut">{{ caught.text }} Due reviews and new cards appear here.</p>
    <div class="row"><button type="button" @click="emit('play', caught.id)">Play quiz</button><button class="ghost" type="button" @click="emit('home')">Home</button></div>
  </div>

  <div v-else-if="phase === 'done' && summary" class="rev">
    <div class="revbar"><span>{{ summary.name }}</span><span class="mid">flashcards</span></div>
    <h1 style="margin-top:28px">Review finished</h1>
    <div class="stats">
      <div><strong>{{ summary.seen }}</strong>cards reviewed</div>
      <div><strong>{{ summary.g.good + summary.g.easy }}</strong>graded Good or Easy</div>
      <div><strong>{{ summary.g.again }}</strong>marked Again</div>
      <div><strong>{{ summary.remaining }}</strong>still to review</div>
    </div>
    <div class="row" style="margin:16px 0">
      <button v-if="summary.remaining" type="button" @click="review(summary.id)">Keep reviewing</button>
      <button class="ghost" type="button" @click="emit('play', summary.id)">Play quiz</button>
      <button class="ghost" type="button" @click="emit('home')">Home</button>
    </div>
    <div class="row sp"><h2>Marked Again or Hard ({{ summary.bad.length }})</h2><button v-if="summary.bad.length" class="ghost" type="button" @click="copyBad">Copy list</button></div>
    <div v-if="summary.bad.length" class="card">
      <div v-for="(x, i) in summary.bad" :key="i" class="row sp" style="padding:7px 0;border-bottom:1px solid var(--line)">
        <span>{{ x.w.a }} — {{ x.w.b }}</span>
        <span><span v-if="x.again" class="tag again">Again {{ x.again }}</span><span v-if="x.hard" class="tag hard">Hard {{ x.hard }}</span></span>
      </div>
    </div>
    <p v-else class="mut">No cards were marked Again or Hard this session.</p>
    <p class="mut">Again brings a card back in a minute. Hard nudges the interval up slowly; Good multiplies it by the card’s ease; Easy multiplies it further. {{ summary.cardsLimit > 0 ? 'Up to ' + summary.cardsLimit + ' cards per session; Again repeats within the session.' : 'This session included every due and new card.' }}</p>
  </div>

  <div v-else class="rev">
    <div class="revbar">
      <span>{{ R.id && db.decks[R.id] ? db.decks[R.id].name : '' }}</span>
      <span class="mid">{{ seenCount }} / {{ R.total }}</span>
      <button id="end" class="ghost" type="button" @click="finishReview">End</button>
    </div>
    <div class="pbar"><i :style="{ width: (R.total ? Math.round(seenCount / R.total * 100) : 0) + '%' }"></i></div>
    <div id="fcard" class="fcard" tabindex="0" role="button" :aria-label="R.reveal ? 'Answer shown' : 'Reveal answer'" @click="reveal">
      <div class="fmeta"><span>{{ R.front }}</span><span>{{ R.w && R.w.fs && R.w.fs.r ? 'card ' + (R.w.fs.r + 1) : 'new card' }}</span></div>
      <div class="fterm" :class="{ small: R.reveal }">{{ R.q }}</div>
      <template v-if="R.reveal">
        <hr class="frule">
        <div class="fback"><div class="fsrc">{{ R.back }}</div><div class="fans">{{ R.ans }}</div></div>
      </template>
      <div v-else class="fhint">Click card or press <kbd>Space</kbd> to reveal</div>
    </div>
    <div v-if="R.reveal" class="fgrade">
      <button v-for="key in ['again', 'hard', 'good', 'easy']" :key="key" :data-g="key" type="button" @click="rate(key)">
        <i>{{ GRADE_KEYS[key] }}</i>{{ GRADES[key] }}<span>{{ R.p[key] }}</span>
      </button>
    </div>
    <p v-if="R.reveal" class="fnote">Keys 1–4 grade · Again repeats the card later in this round.</p>
    <p v-else class="fnote">{{ R.w && R.w.fs && R.w.fs.r ? 'Scheduled ' + fmtWait(R.w.fs.d - Date.now()) + ' · ease ' + Number(R.w.fs.e).toFixed(2) : 'First time seeing this card.' }}</p>
  </div>
</template>
