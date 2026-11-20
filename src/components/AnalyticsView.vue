<script setup>
/* ---------- Analytics ---------- */
import { computed } from 'vue'
import { db, acc, deckDue, weak, shuffle, copyPairs } from '../store.js'

const props = defineProps({ deckId: { type: String, default: null } })
const emit = defineEmits(['home', 'review', 'drill'])

const d = computed(() => db.decks[props.deckId] || null)
const sessions = computed(() => db.sessions.filter((s) => s.id === props.deckId))
const played = computed(() => d.value ? d.value.words.filter((w) => w.s && w.s.n) : [])
const accuracy = computed(() => d.value ? acc(d.value) : null)
const due = computed(() => d.value ? deckDue(d.value) : { due: 0, fresh: 0 })
const rank = computed(() => [...played.value].sort((x, y) => weak(y) - weak(x)))
const need = computed(() => rank.value.filter((w) => weak(w) >= 0.4))
const unseen = computed(() => d.value ? d.value.words.length - played.value.length : 0)
const bad = computed(() => d.value
  ? d.value.words.filter((w) => w.fs && (w.fs.l || w.fs.h))
    .sort((x, y) => ((y.fs.l || 0) * 2 + (y.fs.h || 0)) - ((x.fs.l || 0) * 2 + (x.fs.h || 0)))
  : [])
const recent = computed(() => sessions.value.slice(-10).reverse())

function drillWeakest() { emit('drill', props.deckId, need.value.slice(0, 20).map((w) => w.k)) }
function drillNew() {
  emit('drill', props.deckId,
    shuffle(d.value.words.filter((w) => !w.s || !w.s.n)).slice(0, 20).map((w) => w.k))
}
function copyBad() { copyPairs(bad.value) }
</script>

<template>
  <div v-if="d">
    <div class="row sp"><h1>{{ d.name }}</h1><button class="ghost" type="button" @click="emit('home')">Home</button></div>
    <div class="stats">
      <div><strong>{{ sessions.length }}</strong>rounds played</div>
      <div><strong>{{ accuracy === null ? '–' : accuracy + '%' }}</strong>overall accuracy</div>
      <div><strong>{{ played.length }}/{{ d.words.length }}</strong>words practiced</div>
      <div><strong>{{ need.length }}</strong>need more practice</div>
      <div><strong>{{ due.due + due.fresh }}</strong>cards to review</div>
    </div>
    <div class="row" style="margin:12px 0">
      <button class="ghost" type="button" @click="emit('review', d.id)">Review flashcards{{ due.due + due.fresh ? ' (' + (due.due + due.fresh) + ')' : '' }}</button>
      <button v-if="need.length" type="button" @click="drillWeakest">Drill my {{ Math.min(20, need.length) }} weakest words</button>
      <button v-if="unseen" class="ghost" type="button" @click="drillNew">Drill {{ Math.min(20, unseen) }} new words</button>
    </div>
    <div class="row sp"><h2>Ever marked Again or Hard <span class="mut">({{ bad.length }})</span></h2><button v-if="bad.length" class="ghost" type="button" @click="copyBad">Copy list</button></div>
    <p class="mut">Permanent record. A later Good or Easy grade does not remove a word from this list.</p>
    <div v-if="bad.length" class="tbl">
      <table>
        <tr><th>{{ d.colA }}</th><th>{{ d.colB }}</th><th>Again</th><th>Hard</th></tr>
        <tr v-for="(w, i) in bad" :key="i"><td>{{ w.a }}</td><td>{{ w.b }}</td><td>{{ w.fs.l || 0 }}</td><td>{{ w.fs.h || 0 }}</td></tr>
      </table>
    </div>
    <p v-else class="mut">No words have been marked Again or Hard yet.</p>

    <h2>Words ranked by what needs work</h2>
    <div v-if="played.length" class="tbl">
      <table>
        <tr><th>{{ d.colA }}</th><th>{{ d.colB }}</th><th>Tries</th><th>Correct</th><th>Avg time</th><th>Weakness</th></tr>
        <tr v-for="(w, i) in rank" :key="i">
          <td>{{ w.a }}</td><td>{{ w.b }}</td><td>{{ w.s.n }}</td>
          <td>{{ Math.round(100 * w.s.c / w.s.n) }}%</td><td>{{ (w.s.t / w.s.n).toFixed(1) }}s</td>
          <td><span class="w"><i :style="{ width: Math.round(weak(w) * 100) + '%' }"></i></span></td>
        </tr>
      </table>
    </div>
    <p v-else class="mut">Play a round to see your analytics.</p>
    <p v-if="unseen && played.length" class="mut">{{ unseen }} words have not appeared yet.</p>

    <h2>Recent rounds</h2>
    <div v-if="sessions.length" class="tbl">
      <table>
        <tr><th>Date</th><th>Correct</th><th>Score</th></tr>
        <tr v-for="(s, i) in recent" :key="i"><td>{{ new Date(s.date).toLocaleString() }}</td><td>{{ s.ok }}/{{ s.n }}</td><td>{{ s.score }}</td></tr>
      </table>
    </div>
    <p v-else class="mut">No rounds yet.</p>
  </div>
</template>
