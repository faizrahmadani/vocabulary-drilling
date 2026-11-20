import { ref } from 'vue'
import { THEME_KEY } from './store.js'

function initial() {
  if (document.documentElement.dataset.theme) return document.documentElement.dataset.theme
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Reactive mirror of <html data-theme>, kept in step with the no-flash bootstrap in index.html.
export const theme = ref(initial())

export function toggleTheme() {
  const next = theme.value === 'dark' ? 'light' : 'dark'
  theme.value = next
  document.documentElement.dataset.theme = next
  try { localStorage.setItem(THEME_KEY, next) } catch (e) { /* storage blocked */ }
}
