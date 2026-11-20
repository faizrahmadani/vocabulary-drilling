<script setup>
/* ---------- Quiz ---------- */
import { reactive, ref, nextTick, onMounted, onUnmounted } from 'vue'
import { db, save, shuffle, weak } from '../store.js'

const props = defineProps({ deckId: { type: String, default: null }, only: { type: Array, default: null } })
const emit = defineEmits(['home', 'stats', 'replay'])

const blank = () => ({
  id: null, list: [], i: 0, score: 0, streak: 0, best: 0, ok: 0, missed: [],
  w: null, ans: '', opts: [], locked: false, limit: 1, start: 0, q: '', picked: -1, bar: 100,
})
const Q = reactive(blank())
const phase = ref('ask') // 'ask' | 'done'
const feedback = ref('')
const summary = ref(null)
const nxBtn = ref(null)
let tick = null, to = null

function start(id = props.deckId, only = props.only) {
  clearInterval(tick); clearTimeout(to)
  const d = db.decks[id]
  if (!d) { emit('home'); return }
  if (d.words.length < 4) { alert('This deck needs at least 4 words to play.'); emit('home'); return }
  const c = db.cfg
  let pool = d.words.filter((w) => !only || only.includes(w.k))
  const wt = (w) => c.focus && !only ? 0.2 + 2 * weak(w) : 1
  pool = pool.map((w) => [Math.random() ** (1 / wt(w)), w]).sort((x, y) => y[0] - x[0]).map((x) => x[1])
  if (c.n > 0) pool = pool.slice(0, c.n)
  Object.assign(Q, blank(), { id, list: pool })
  phase.value = 'ask'
  feedback.value = ''
  summary.value = null
  ask()
}

function ask() {
  const d = db.decks[Q.id], w = Q.list[Q.i], c = db.cfg
  const f = c.dir === 'mix' ? Math.random() < 0.5 : c.dir === 'ab' // show column A, answer in column B
  const q = f ? w.a : w.b, ans = f ? w.b : w.a
  const ds = [...new Set(shuffle(d.words.filter((x) => x !== w)).map((x) => f ? x.b : x.a).filter((t) => t !== ans))].slice(0, 3)
  Q.w = w; Q.ans = ans; Q.opts = shuffle([ans, ...ds]); Q.locked = false
  Q.limit = c.sec * 1000; Q.start = Date.now(); Q.q = q; Q.picked = -1; Q.bar = 100
  feedback.value = ''
  clearInterval(tick)
  tick = setInterval(() => {
    const l = 1 - (Date.now() - Q.start) / Q.limit
    Q.bar = Math.max(0, l * 100)
    if (l <= 0) pick(-1)
  }, 100)
}

function pick(i) {
  if (Q.locked || phase.value !== 'ask') return
  Q.locked = true
  Q.picked = i
  clearInterval(tick)
  const dt = Math.min(Date.now() - Q.start, Q.limit)
  const ok = i >= 0 && Q.opts[i] === Q.ans
  const w = Q.w
  w.s = w.s || { n: 0, c: 0, t: 0 }
  w.s.n++; w.s.c += ok ? 1 : 0; w.s.t += dt / 1000; w.s.last = Date.now()
  if (ok) {
    Q.ok++; Q.streak++; Q.best = Math.max(Q.best, Q.streak)
    Q.score += Math.round(500 + 500 * (1 - dt / Q.limit)) + Math.min(Q.streak - 1, 5) * 50
  } else {
    Q.streak = 0; Q.missed.push(w)
  }
  save()
  feedback.value = ok ? 'Correct!' : (i < 0 ? 'Time’s up. ' : 'Not quite. ') + 'Answer: ' + Q.ans
  nextTick(() => nxBtn.value && nxBtn.value.focus())
  to = setTimeout(next, ok ? 1100 : 2600)
}

function next() {
  clearTimeout(to)
  Q.i++
  if (Q.i < Q.list.length) ask()
  else finish()
}

function finish() {
  clearInterval(tick); clearTimeout(to)
  const answered = Q.i + (Q.locked ? 1 : 0)
  const r = { id: Q.id, ok: Q.ok, score: Q.score, best: Q.best, missed: [...Q.missed] }
  if (answered > 0) {
    db.sessions.push({ id: r.id, date: Date.now(), n: answered, ok: r.ok, score: r.score })
    save()
  }
  summary.value = { ...r, answered, p: answered ? Math.round(100 * r.ok / answered) : 0 }
  phase.value = 'done'
}

function quit() {
  if (confirm('Quit this round? Answers so far are kept.')) finish()
}

function replay(id, only = null) { emit('replay', id, only) }

function onKey(e) {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return
  if (phase.value !== 'ask') return
  if (!Q.locked && '1234'.includes(e.key) && Q.opts[+e.key - 1] !== undefined) {
    e.preventDefault(); pick(+e.key - 1)
  } else if (Q.locked && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault(); next()
  }
}

onMounted(() => { window.addEventListener('keydown', onKey); start() })
onUnmounted(() => { clearInterval(tick); clearTimeout(to); window.removeEventListener('keydown', onKey) })
</script>

<template>
  <div v-if="phase === 'ask'">
    <div class="row sp mut">
      <span>Question {{ Q.i + 1 }} / {{ Q.list.length }}</span>
      <span>Score <b>{{ Q.score }}</b> · Streak <b>{{ Q.streak }}</b></span>
      <button class="ghost" type="button" @click="quit">Quit</button>
    </div>
    <div class="bar" style="margin-top:8px"><i :style="{ width: Q.bar + '%' }"></i></div>
    <div class="q">{{ Q.q }}</div>
    <div id="fb" class="fb">{{ feedback }}</div>
    <div class="opts">
      <button v-for="(o, i) in Q.opts" :key="i" class="opt" :class="['o' + i, {
        ok: Q.locked && o === Q.ans,
        bad: Q.locked && i === Q.picked && o !== Q.ans,
        dim: Q.locked && o !== Q.ans && i !== Q.picked,
      }]" :disabled="Q.locked" @click="pick(i)">
        <b>{{ '▲◆●■'[i] }}</b><span>{{ o }}</span>
      </button>
    </div>
    <div class="row" style="justify-content:center;margin-top:10px">
      <button id="nx" ref="nxBtn" class="ghost" type="button" v-show="Q.locked" @click="next">Next</button>
    </div>
  </div>

  <div v-else-if="summary">
    <h1>Round complete</h1>
    <div class="stats">
      <div><strong>{{ summary.score }}</strong>score</div>
      <div><strong>{{ summary.p }}%</strong>{{ summary.ok }} of {{ summary.answered }} correct</div>
      <div><strong>{{ summary.best }}</strong>best streak</div>
    </div>
    <h2>Words to review</h2>
    <div v-if="summary.missed.length" class="card">
      <div v-for="(w, i) in summary.missed" :key="i">{{ w.a }} — {{ w.b }}</div>
    </div>
    <p v-else class="mut">No mistakes this round.</p>
    <div class="row">
      <button type="button" @click="replay(summary.id)">Play again</button>
      <button v-if="summary.missed.length" class="ghost" type="button" @click="replay(summary.id, summary.missed.map(w => w.k))">Drill missed words</button>
      <button class="ghost" type="button" @click="emit('stats', summary.id)">Analytics</button>
      <button class="ghost" type="button" @click="emit('home')">Home</button>
    </div>
  </div>
</template>
