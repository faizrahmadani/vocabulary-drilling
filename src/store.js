/* ---------- Core state: persistence + pure helpers ---------- */
import { reactive } from 'vue'

export const KEY = 'vocabdrill.v1'
export const THEME_KEY = 'vocabdrill.theme'
export const MIN = 6e4
export const DAY = 864e5

const DEFAULT_CFG = { dir: 'mix', n: 20, sec: 15, focus: true, cards: 20 }
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Defensively turn arbitrary parsed JSON into a usable db shape. */
export function normalize(raw) {
  const d = isObj(raw) ? { ...raw } : {}
  d.decks = isObj(d.decks) ? d.decks : {}
  for (const id of Object.keys(d.decks)) {
    const deck = d.decks[id]
    if (!isObj(deck) || !Array.isArray(deck.words)) { delete d.decks[id]; continue }
    deck.name = typeof deck.name === 'string' ? deck.name : id
    deck.colA = typeof deck.colA === 'string' ? deck.colA : 'Column 1'
    deck.colB = typeof deck.colB === 'string' ? deck.colB : 'Column 2'
  }
  d.sessions = Array.isArray(d.sessions) ? d.sessions : []
  d.pastes = Array.isArray(d.pastes) ? d.pastes : []
  d.cfg = Object.assign({}, DEFAULT_CFG, isObj(d.cfg) ? d.cfg : {})
  return d
}

function rawLoad() {
  let parsed = null
  try { parsed = JSON.parse(localStorage.getItem(KEY)) } catch (e) { /* corrupt -> defaults */ }
  return normalize(parsed)
}

// One reactive store shared by every view; mutating it updates the UI and save() persists it.
export const db = reactive(rawLoad())

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch (e) { /* quota / storage disabled */ }
}

/** Replace all data while keeping the reactive object identity so open views stay in sync. */
export function replaceDb(data) {
  const next = normalize(data)
  Object.keys(db).forEach((k) => delete db[k])
  Object.assign(db, next)
  save()
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

export const shuffle = (a) => {
  const out = [...a]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.random() * (i + 1) | 0
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// weakness 0..1 (higher = needs more practice); unseen words sit in the middle
export const weak = (w) => {
  const s = w.s
  if (!s || !s.n) return 0.6
  const e = (s.n - s.c + 1) / (s.n + 2)
  return Math.min(1, e + (s.t / s.n > 8 ? 0.1 : 0))
}

export const acc = (d) => {
  let n = 0, c = 0
  d.words.forEach((w) => { if (w.s) { n += w.s.n; c += w.s.c } })
  return n ? Math.round(100 * c / n) : null
}

export const deckDue = (d) => {
  const t = Date.now()
  let due = 0, fresh = 0
  d.words.forEach((w) => { if (!w.fs || !w.fs.r) fresh++; else if (w.fs.d <= t) due++ })
  return { due, fresh }
}

export function fmtWait(ms) {
  if (ms < MIN) return 'in under a minute'
  if (ms < 36e5) return 'in ' + Math.round(ms / MIN) + ' min'
  if (ms < DAY) return 'in ' + Math.round(ms / 36e5) + ' h'
  return 'in ' + Math.round(ms / DAY) + ' day' + (Math.round(ms / DAY) === 1 ? '' : 's')
}

// Split each pasted line into [column 1, column 2]. Excel copies as tab-separated; other separators also work.
export function parsePaste(t) {
  const out = []
  const un = (s) => s.trim().replace(/^"(.*)"$/, '$1').trim()
  String(t || '').split(/\r?\n/).forEach((l) => {
    if (!l.trim()) return
    for (const s of ['\t', ';', '|', ' - ', ',']) {
      const i = l.indexOf(s)
      if (i > 0) {
        const a = un(l.slice(0, i)), b = un(l.slice(i + s.length).split('\t')[0])
        if (a && b) out.push({ a, b })
        break
      }
    }
  })
  return out
}

export function previews(w) {
  const c = w.fs || { i: 0, e: 2.5 }
  return {
    again: '1 min',
    hard: c.i ? Math.max(1, Math.round(c.i * 1.2)) + ' d' : '10 min',
    good: c.i ? Math.max(1, Math.round(c.i * c.e)) + ' d' : '1 d',
    easy: c.i ? Math.max(2, Math.round(c.i * c.e * 1.3)) + ' d' : '3 d',
  }
}

export async function copyPairs(ws) {
  const text = ws.map((w) => w.a + '\t' + w.b).join('\n')
  try {
    await navigator.clipboard.writeText(text)
  } catch (e) {
    const a = document.createElement('textarea')
    a.value = text
    a.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(a)
    a.select()
    try { document.execCommand('copy') } catch (err) { /* clipboard unavailable */ }
    a.remove()
  }
}
