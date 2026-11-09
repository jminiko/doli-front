<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'

const route = useRoute()
const router = useRouter()
const locale = ref(localStorage.getItem('atelier.locale') || 'fr')
const page = ref(null)
const notice = ref('')
const error = ref('')

async function load() {
  page.value = await api('/api/careers', { locale: locale.value })
}

async function apply(event) {
  error.value = ''
  notice.value = ''
  const body = {}
  for (const [name, value] of new FormData(event.target).entries()) body[name] = value
  try {
    const result = await api('/api/careers', { method: 'POST', locale: locale.value, body })
    notice.value = result.notice || page.value.labels.sent
    await router.replace({ path: '/careers' })
    await load()
  } catch (cause) {
    error.value = cause.message
  }
}

onMounted(() => load().catch((cause) => { error.value = cause.message }))
</script>

<template>
  <main class="careers">
    <p v-if="error && !page" class="error">{{ error }}</p>
    <template v-if="page">
    <header>
      <p class="careers-kicker">OpenCATS</p>
      <h1>{{ page.siteName }}</h1>
      <p>{{ page.title }}</p>
    </header>
    <p v-if="notice" class="message">{{ notice }}</p>
    <p v-if="error" class="error">{{ error }}</p>
    <p v-if="!page.enabled" class="ats-note">{{ page.closed }}</p>
    <article v-for="job in page.jobs" :key="job.id" class="careers-job">
      <h2>{{ job.title }}</h2>
      <p class="ats-note">{{ job.company }} <span v-if="job.city">· {{ job.city }}</span></p>
      <p class="careers-text">{{ job.description }}</p>
      <form v-if="route.query.job === job.id" class="careers-form" @submit.prevent="apply">
        <input type="hidden" name="job" :value="job.id" />
        <label>{{ page.labels.first }}<input class="flat" name="firstName" required /></label>
        <label>{{ page.labels.last }}<input class="flat" name="lastName" required /></label>
        <label>{{ page.labels.email }}<input class="flat" name="email1" type="email" required /></label>
        <label>{{ page.labels.phone }}<input class="flat" name="phoneCell" /></label>
        <label>{{ page.labels.city }}<input class="flat" name="city" /></label>
        <label>{{ page.labels.notes }}<textarea class="flat" name="notes" rows="4"></textarea></label>
        <button class="butAction" type="submit">{{ page.labels.apply }}</button>
      </form>
      <button v-else class="butAction" type="button" @click="router.push({ path: '/careers', query: { job: job.id } })">{{ page.labels.apply }}</button>
    </article>
    </template>
  </main>
</template>
