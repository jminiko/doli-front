<script setup>
import { inject, onMounted, reactive, ref } from 'vue'
import { api } from '../api'

const locale = inject('locale')
const nav = inject('nav')
const error = inject('error')
const reloadNav = inject('reloadNav')
const catalogue = ref({ languages: [], keys: [], values: {} })
const draft = reactive({ code: '', name: '' })

async function load() {
  catalogue.value = await api('/api/labels', { locale: locale.value })
}

async function save(key, language, event) {
  await api('/api/labels', {
    locale: locale.value,
    method: 'PUT',
    body: { key, locale: language, value: event.target.value }
  })
  await reloadNav()
}

async function addLanguage() {
  catalogue.value = await api('/api/languages', { locale: locale.value, method: 'POST', body: { ...draft } })
  draft.code = ''
  draft.name = ''
  await reloadNav()
}

async function removeLanguage(code) {
  catalogue.value = await api(`/api/languages/${code}`, { locale: locale.value, method: 'DELETE' })
  await reloadNav()
}

function cell(key, code) {
  return catalogue.value.values?.[key]?.[code] || ''
}

onMounted(() => load().catch((cause) => { error.value = cause.message }))
</script>

<template>
  <table class="table-fiche-title">
    <tbody>
      <tr class="toptitle">
        <td class="col-title"><div class="titre"><i class="bi bi-translate"></i>{{ nav.menus.flatMap((menu) => menu.entries).find((entry) => entry.target === 'translate')?.label || nav.chrome['menu.translations'] }}</div></td>
      </tr>
    </tbody>
  </table>
  <p class="opacitymedium">{{ nav.chrome['translate.hint'] }}</p>
  <form class="inline-form" @submit.prevent="addLanguage().catch((cause) => { error.value = cause.message })">
    <div>
      <label>{{ nav.chrome['lang.code'] }}</label>
      <input v-model="draft.code" class="flat" maxlength="3" required />
    </div>
    <div>
      <label>{{ nav.chrome['lang.name'] }}</label>
      <input v-model="draft.name" class="flat" required />
    </div>
    <button class="butAction" type="submit">{{ nav.chrome['lang.add'] }}</button>
  </form>
  <div class="tabsAction" style="text-align: left">
    <button v-for="language in catalogue.languages.filter((item) => !item.defaultLanguage)" :key="language.code" class="butActionDelete" type="button" @click="removeLanguage(language.code).catch((cause) => { error.value = cause.message })">
      {{ nav.chrome['action.removeLanguage'] }} {{ language.name }}
    </button>
  </div>
  <div class="div-table-responsive">
    <table class="tagtable liste">
      <thead>
        <tr class="liste_titre">
          <th>Key</th>
          <th v-for="language in catalogue.languages" :key="language.code">{{ language.name }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="key in catalogue.keys" :key="key" class="oddeven">
          <td class="opacitymedium">{{ key }}</td>
          <td v-for="language in catalogue.languages" :key="language.code">
            <input class="flat" :value="cell(key, language.code)" @change="save(key, language.code, $event).catch((cause) => { error.value = cause.message })" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
