<script setup>
import { inject, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api'
import { href } from '../nav'
import FileLibrary from './FileLibrary.vue'
import ImmoDesk from './ImmoDesk.vue'

const route = useRoute()
const locale = inject('locale')
const nav = inject('nav')
const error = inject('error')
const reloadNav = inject('reloadNav')
const page = ref(null)
const values = reactive({})
const payload = ref('')
const notice = ref('')

async function load() {
  error.value = ''
  notice.value = ''
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(route.query)) {
    if (value != null && value !== '') query.set(key, Array.isArray(value) ? value[0] : value)
  }
  const suffix = query.toString() ? `?${query}` : ''
  page.value = await api(`/api/system/${route.params.id}${suffix}`, { locale: locale.value })
  Object.keys(values).forEach((key) => delete values[key])
  for (const field of page.value.fields || []) {
    values[field.name] = field.type === 'bool' ? field.value === '1' || field.value === 'true' : (field.value ?? '')
  }
  if (page.value.kind === 'vat') {
    values.fromRate = page.value.fromRate
    values.toRate = page.value.toRate
  }
  if (page.value.kind === 'purge') {
    values.days = page.value.days
  }
  if (page.value.kind === 'menus') {
    for (const group of page.value.groups || []) {
      for (const entry of group.entries) {
        values[`hide_${entry.id}`] = !!entry.hidden
      }
    }
  }
}

async function save() {
  const body = page.value.kind === 'restore' ? { payload: payload.value } : { ...values }
  const saved = await api(`/api/system/${route.params.id}`, { locale: locale.value, method: 'POST', body })
  const text = saved.notice || nav.value.chrome['action.saved']
  await reloadNav()
  await load()
  notice.value = text
  if (page.value) page.value.notice = text
}

onMounted(() => load().catch((cause) => { error.value = cause.message }))
watch(() => route.fullPath, () => load().catch((cause) => { error.value = cause.message }))
</script>

<template>
  <div v-if="page">
    <table class="table-fiche-title">
      <tbody>
        <tr class="toptitle">
          <td class="col-title"><div class="titre"><i :class="['bi', page.icon || 'bi-sliders']"></i>{{ page.title }}</div></td>
        </tr>
      </tbody>
    </table>
    <p v-if="page.notice" class="message">{{ page.notice }}</p>
    <p v-for="alert in page.alerts || []" :key="alert" class="error">{{ alert }}</p>
    <p v-if="page.hint" class="opacitymedium">{{ page.hint }}</p>

    <div v-if="page.kind === 'summary'" class="box-grid">
      <router-link v-for="(card, index) in page.cards" :key="card.id" class="info-box" :to="href(card)">
        <span class="info-box-icon" :class="'bg' + ((index % 6) + 1)"><i :class="['bi', card.icon || 'bi-sliders']"></i></span>
        <span class="info-box-content"><span class="info-box-title">{{ card.label }}</span></span>
      </router-link>
    </div>

    <form v-else-if="page.kind === 'setup'" @submit.prevent="save().catch((cause) => { error.value = cause.message })">
      <table class="border">
        <tbody>
          <tr v-for="field in page.fields" :key="field.name">
            <td class="titlefield"><label :for="'field-' + field.name">{{ field.label }}</label></td>
            <td>
              <textarea v-if="field.type === 'area'" :id="'field-' + field.name" v-model="values[field.name]" class="flat" rows="3"></textarea>
              <input v-else-if="field.type === 'bool'" :id="'field-' + field.name" v-model="values[field.name]" class="flat" type="checkbox" />
              <select v-else-if="field.type === 'choice'" :id="'field-' + field.name" v-model="values[field.name]" class="flat">
                <option value=""></option>
                <option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <input v-else-if="field.type === 'number'" :id="'field-' + field.name" v-model="values[field.name]" class="flat" type="number" step="any" />
              <input v-else :id="'field-' + field.name" v-model="values[field.name]" class="flat" type="text" />
            </td>
          </tr>
        </tbody>
      </table>
      <div class="tabsAction"><button class="butAction" type="submit">{{ nav.chrome['action.save'] }}</button></div>
    </form>

    <div v-else-if="page.kind === 'checks'">
      <table class="tagtable liste">
        <thead>
          <tr class="liste_titre">
            <th v-for="column in page.columns" :key="column">{{ column }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="check in page.checks" :key="check.label" class="oddeven">
            <td>{{ check.label }}</td>
            <td>{{ check.state }}</td>
            <td>{{ check.detail }}</td>
          </tr>
        </tbody>
      </table>
      <p>{{ page.apiLabel }} : <span class="badge">{{ page.apiUrl }}</span></p>
      <p class="message">{{ page.verdict }}</p>
    </div>

    <div v-else-if="page.kind === 'info'">
      <section v-for="section in page.sections" :key="section.title">
        <h2 class="opacitymedium">{{ section.title }}</h2>
        <table class="border">
          <tbody>
            <tr v-for="row in section.rows" :key="row.label">
              <td class="titlefield">{{ row.label }}</td>
              <td>
                <a v-if="row.href" :href="row.href" target="_blank" rel="noopener">{{ row.value }}</a>
                <template v-else>{{ row.value }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <form v-else-if="page.kind === 'menus'" @submit.prevent="save().catch((cause) => { error.value = cause.message })">
      <section v-for="group in page.groups" :key="group.label">
        <h2 class="opacitymedium">{{ group.label }}</h2>
        <table class="border">
          <tbody>
            <tr v-for="entry in group.entries" :key="entry.id">
              <td class="titlefield" :style="{ paddingLeft: `${(entry.level || 1) * 16}px` }">{{ entry.label }}</td>
              <td>
                <label>
                  <input v-model="values['hide_' + entry.id]" type="checkbox" :disabled="entry.locked" />
                  {{ nav.chrome['menu.hide'] || 'Masquer' }}
                </label>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
      <div class="tabsAction"><button class="butAction" type="submit">{{ nav.chrome['action.save'] }}</button></div>
    </form>

    <table v-else-if="page.kind === 'dictionaries'" class="tagtable liste">
      <tbody>
        <tr v-for="entry in page.entries" :key="entry.id" class="oddeven">
          <td><router-link :to="href(entry)">{{ entry.label }}</router-link></td>
        </tr>
      </tbody>
    </table>

    <p v-else-if="page.kind === 'backup'">
      <a class="butAction" href="/api/admin/backup">{{ nav.chrome['action.download'] }}</a>
    </p>

    <form v-else-if="page.kind === 'restore'" @submit.prevent="save().catch((cause) => { error.value = cause.message })">
      <textarea v-model="payload" class="flat" rows="8" style="width: 100%"></textarea>
      <div class="tabsAction"><button class="butAction" type="submit">{{ nav.chrome['action.restore'] }}</button></div>
    </form>

    <form v-else-if="page.kind === 'purge'" @submit.prevent="save().catch((cause) => { error.value = cause.message })">
      <table class="border">
        <tbody>
          <tr>
            <td class="titlefield"><label for="days">{{ nav.chrome['setup.purgeDays'] }}</label></td>
            <td><input id="days" v-model="values.days" class="flat" type="number" /></td>
          </tr>
        </tbody>
      </table>
      <div class="tabsAction"><button class="butActionDelete" type="submit">{{ nav.chrome['action.purge'] }}</button></div>
    </form>

    <FileLibrary v-else-if="page.kind === 'library'" :page="page" @update="page = $event" />
    <ImmoDesk v-else-if="page.kind === 'ledger'" :page="page" @update="page = $event" />
    <form v-else-if="page.kind === 'vat'" @submit.prevent="save().catch((cause) => { error.value = cause.message })">
      <table class="border">
        <tbody>
          <tr>
            <td class="titlefield"><label for="fromRate">{{ nav.chrome['setup.vatFrom'] }}</label></td>
            <td><input id="fromRate" v-model="values.fromRate" class="flat" /></td>
          </tr>
          <tr>
            <td class="titlefield"><label for="toRate">{{ nav.chrome['setup.vatTo'] }}</label></td>
            <td><input id="toRate" v-model="values.toRate" class="flat" /></td>
          </tr>
        </tbody>
      </table>
      <div class="tabsAction"><button class="butAction" type="submit">{{ nav.chrome['action.apply'] }}</button></div>
    </form>
  </div>
</template>
