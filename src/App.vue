<script setup>
import { ref } from 'vue'
import HomeView from './components/HomeView.vue'
import QuizView from './components/QuizView.vue'
import ReviewView from './components/ReviewView.vue'
import AnalyticsView from './components/AnalyticsView.vue'
import MemberView from './components/MemberView.vue'

// Lightweight screen state machine — one view is mounted at a time so timers/listeners
// are cleaned up on navigation (onUnmounted in QuizView / ReviewView).
const screen = ref('home')
const payload = ref({ id: null, only: null })

function goHome() { screen.value = 'home' }
function startQuiz(id, only = null) { payload.value = { id, only }; screen.value = 'quiz' }
function openReview(id) { payload.value = { id }; screen.value = 'review' }
function openStats(id) { payload.value = { id }; screen.value = 'analytics' }
function openMember() { screen.value = 'member' }
function drill(id, keys) { startQuiz(id, keys) }
</script>

<template>
  <HomeView v-if="screen === 'home'" @play="startQuiz" @review="openReview" @stats="openStats"
            @member="openMember" />
  <QuizView v-else-if="screen === 'quiz'" :deck-id="payload.id" :only="payload.only"
            @home="goHome" @stats="openStats" @replay="startQuiz" />
  <ReviewView v-else-if="screen === 'review'" :deck-id="payload.id"
              @home="goHome" @stats="openStats" @play="startQuiz" />
  <AnalyticsView v-else-if="screen === 'analytics'" :deck-id="payload.id" @home="goHome"
                 @review="openReview" @drill="drill" />
  <MemberView v-else @home="goHome" />
</template>
