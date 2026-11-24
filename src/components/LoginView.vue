<script setup>
/* ---------- Login ---------- */
import { ref } from 'vue'
import { api } from '../api.js'

const emit = defineEmits(['signed-in', 'home'])

const email = ref('')
const password = ref('')
const busy = ref(false)
const error = ref('')

async function submit() {
  if (busy.value) return
  if (!email.value.trim() || !password.value) {
    error.value = 'Enter both your email and password.'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const response = await api('/api/login', {
      method: 'POST',
      body: { email: email.value.trim(), password: password.value },
    })
    if (response.ok && response.data?.ok) {
      password.value = ''
      emit('signed-in')
    } else {
      // Deliberately generic: never reveal whether the email exists.
      error.value = 'Invalid email or password.'
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="auth-card">
    <h2>Sign in</h2>
    <p class="mut">Enter your member credentials to open this page.</p>
    <form @submit.prevent="submit">
      <label class="auth-field">
        <span>Email</span>
        <input v-model="email" type="email" name="email" autocomplete="username" required>
      </label>
      <label class="auth-field">
        <span>Password</span>
        <input v-model="password" type="password" name="password" autocomplete="current-password" required>
      </label>
      <p v-if="error" class="auth-error" role="alert">{{ error }}</p>
      <div class="auth-actions">
        <button class="btn btn-primary" type="submit" :disabled="busy">
          {{ busy ? 'Signing in…' : 'Sign in' }}
        </button>
        <button class="btn btn-ghost" type="button" @click="emit('home')">Back home</button>
      </div>
    </form>
  </div>
</template>
