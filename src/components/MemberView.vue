<script setup>
/* ---------- Member (protected page) ---------- */
import { onMounted, ref } from 'vue'
import { api } from '../api.js'
import LoginView from './LoginView.vue'
import ThemeToggle from './ThemeToggle.vue'

const emit = defineEmits(['home'])

// loading | signed-in | signed-out | error
const state = ref('loading')
const email = ref('')
const busy = ref(false)

async function load() {
  state.value = 'loading'
  const response = await api('/api/me')
  if (response.status === 401) {
    email.value = ''
    state.value = 'signed-out'
  } else if (response.ok && response.data?.ok) {
    email.value = String(response.data.email || '')
    state.value = 'signed-in'
  } else {
    state.value = 'error'
  }
}

async function logout() {
  if (busy.value) return
  busy.value = true
  const response = await api('/api/logout', { method: 'POST', body: {} })
  busy.value = false
  if (response.ok && response.data?.ok) {
    await load()
  }
}

onMounted(load)
</script>

<template>
  <div class="auth">
    <div class="auth-head"><h1>Member</h1><ThemeToggle /></div>

    <div v-if="state === 'loading'" class="auth-card" aria-live="polite">Checking your session…</div>

    <div v-else-if="state === 'signed-in'" class="auth-card">
      <h2>You are signed in</h2>
      <p class="auth-ok">{{ email }}</p>
      <p class="mut">This page is only visible while your member session is valid.</p>
      <div class="auth-actions">
        <button class="btn btn-primary" type="button" :disabled="busy" @click="logout">
          {{ busy ? 'Signing out…' : 'Log out' }}
        </button>
        <button class="btn btn-ghost" type="button" @click="emit('home')">Back home</button>
      </div>
    </div>

    <LoginView v-else-if="state === 'signed-out'" @signed-in="load" @home="emit('home')" />

    <div v-else class="auth-card">
      <h2>Member service unavailable</h2>
      <p class="mut">The local backend is not running, so the session cannot be checked. Your drills still work from the home screen.</p>
      <div class="auth-actions">
        <button class="btn btn-ghost" type="button" @click="load">Try again</button>
        <button class="btn btn-ghost" type="button" @click="emit('home')">Back home</button>
      </div>
    </div>
  </div>
</template>
