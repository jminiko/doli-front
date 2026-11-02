<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { api, remember } from '../api'

const router = useRouter()
const locale = ref(localStorage.getItem('atelier.locale') || 'fr')
const login = ref('')
const password = ref('')
const error = ref('')
const languages = [
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'es', name: 'Español' }
]
const copy = {
  fr: { title: 'Connexion', login: 'Identifiant', password: 'Mot de passe', submit: 'Se connecter' },
  en: { title: 'Sign in', login: 'Login', password: 'Password', submit: 'Sign in' },
  de: { title: 'Anmeldung', login: 'Benutzername', password: 'Passwort', submit: 'Anmelden' },
  es: { title: 'Conexion', login: 'Usuario', password: 'Contrasena', submit: 'Entrar' }
}
const text = computed(() => copy[locale.value] || copy.fr)

function chooseLocale(event) {
  locale.value = event.target.value
  localStorage.setItem('atelier.locale', locale.value)
}

onMounted(() => {
  if (document.getElementById('active-theme')) return
  const node = document.createElement('link')
  node.id = 'active-theme'
  node.rel = 'stylesheet'
  node.href = '/api/theme.css'
  document.head.appendChild(node)
})

async function submit() {
  error.value = ''
  try {
    const user = await api('/api/login', {
      locale: locale.value,
      method: 'POST',
      body: { login: login.value, password: password.value }
    })
    remember(user)
    await router.push('/')
  } catch (cause) {
    error.value = cause.message
  }
}
</script>

<template>
  <form class="login-card" @submit.prevent="submit">
    <h1>Atelier</h1>
    <p>{{ text.title }}</p>
    <p v-if="error" class="error">{{ error }}</p>
    <label for="login">{{ text.login }}</label>
    <input id="login" v-model="login" class="flat" autocomplete="username" required />
    <label for="password">{{ text.password }}</label>
    <input id="password" v-model="password" class="flat" type="password" autocomplete="current-password" required />
    <button class="butAction" type="submit">{{ text.submit }}</button>
    <select class="login-lang" aria-label="language" :value="locale" @change="chooseLocale">
      <option v-for="language in languages" :key="language.code" :value="language.code">{{ language.name }}</option>
    </select>
  </form>
</template>
