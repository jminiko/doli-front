<script setup>
import { inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, assertFormSize } from '../api'
import RichEditor from '../components/RichEditor.vue'

const props = defineProps({ page: { type: Object, required: true } })
const emit = defineEmits(['update'])
const route = useRoute()
const router = useRouter()
const locale = inject('locale')
const nav = inject('nav')
const error = inject('error')

function target(query) {
  return { path: route.path, query }
}

async function refresh(query) {
  const suffix = new URLSearchParams(query).toString()
  await router.replace({ path: route.path, query })
  emit('update', await api(`/api/system/opencats?${suffix}`, { locale: locale.value }))
}

async function call(verb, body) {
  error.value = ''
  const result = await api(`/api/plugins/opencats/${verb}`, { method: 'POST', locale: locale.value, body })
  const query = { section: result.section || props.page.section }
  if (result.row) query.row = result.row
  await refresh(query)
}

function payload(form, fields = []) {
  const body = {}
  for (const [name, value] of new FormData(form).entries()) {
    if (body[name] == null) body[name] = value
    else if (Array.isArray(body[name])) body[name].push(value)
    else body[name] = [body[name], value]
  }
  for (const field of fields) {
    if (field.type === 'bool' && body[field.name] == null) body[field.name] = '0'
  }
  return body
}

function submit(event, fields = []) {
  const form = event.target
  call(form.dataset.verb || 'save', payload(form, fields)).catch((cause) => { error.value = cause.message })
}

function filter(event) {
  const query = { section: props.page.section }
  for (const [name, value] of new FormData(event.target).entries()) {
    if (value !== '') query[name] = value
  }
  router.push({ path: route.path, query })
}

async function upload(event) {
  error.value = ''
  try {
    assertFormSize(event.target, nav.value)
    const data = new FormData(event.target)
    const response = await fetch(`/api/plugins/opencats/attach?lang=${encodeURIComponent(locale.value)}`, { method: 'POST', credentials: 'include', body: data })
    const result = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(result.error || response.statusText)
    await refresh({ section: props.page.section, row: result.row || props.page.row })
  } catch (cause) {
    error.value = cause.message
  }
}
</script>

<template>
  <div class="ats-desk">
    <nav class="ats-tabs">
      <router-link v-for="tab in page.tabs || []" :key="tab.section" :class="{ on: tab.current }" :to="target({ section: tab.section })">{{ tab.label }}</router-link>
    </nav>
    <header class="ats-head">
      <h2>{{ page.heading }}</h2>
      <div class="ats-links">
        <router-link v-for="link in page.links || []" :key="link.label" class="butActionNew" :to="target({ section: link.section, row: link.row })">{{ link.label }}</router-link>
        <a v-if="page.export" class="butAction" :href="`/api/plugins/opencats/raw/${page.export.node}`">{{ page.export.label }}</a>
      </div>
    </header>
    <p v-for="line in page.notes || []" :key="line" class="ats-note">{{ line }}</p>

    <div v-if="page.stats" class="ats-stats">
      <article v-for="stat in page.stats" :key="stat.label" class="ats-stat"><b>{{ stat.value }}</b><span>{{ stat.label }}</span></article>
    </div>

    <form v-if="page.filters" class="ats-filters" @submit.prevent="filter">
      <label v-for="field in page.filters" :key="field.name">{{ field.label }}
        <select v-if="field.options" class="flat" :name="field.name">
          <option v-for="option in field.options" :key="option.value" :value="option.value" :selected="option.value === (field.value || '')">{{ option.label }}</option>
        </select>
        <input v-else class="flat" :name="field.name" :value="field.value || ''" />
      </label>
      <button class="butAction" type="submit">{{ page.labels.search }}</button>
    </form>

    <div v-if="page.calendar" class="ats-month">
      <div class="ats-links">
        <router-link class="butActionNew" :to="target({ section: 'calendar', month: page.calendar.prev })">{{ page.calendar.prev }}</router-link>
        <strong>{{ page.calendar.month }}</strong>
        <router-link class="butActionNew" :to="target({ section: 'calendar', month: page.calendar.next })">{{ page.calendar.next }}</router-link>
      </div>
      <table class="ats-calendar">
        <thead><tr><th v-for="day in page.calendar.weekdays" :key="day">{{ day }}</th></tr></thead>
        <tbody>
          <tr v-for="(week, index) in page.calendar.weeks" :key="index">
            <td v-for="day in week" :key="day.date" :class="{ out: !day.inMonth }">
              <router-link :to="target({ section: 'calendar', month: page.calendar.month, date: day.date })">{{ day.date.slice(-2) }}</router-link>
              <router-link v-for="event in day.events" :key="event.id" class="ats-event" :to="target({ section: 'calendar', month: page.calendar.month, row: event.id })">{{ event.time }} {{ event.title }}</router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <section v-for="block in page.reports || []" :key="block.title" class="ats-block">
      <h3>{{ block.title }}</h3>
      <table class="tagtable liste">
        <thead><tr class="liste_titre"><th v-for="header in block.headers" :key="header">{{ header }}</th></tr></thead>
        <tbody>
          <tr v-for="(row, index) in block.rows" :key="index"><td v-for="(cell, cellIndex) in row" :key="cellIndex">{{ cell }}</td></tr>
          <tr v-if="!(block.rows || []).length"><td :colspan="block.headers.length">{{ page.empty }}</td></tr>
        </tbody>
      </table>
    </section>

    <div :class="{ 'ats-layout': page.form && (page.pipeline || page.activity || page.files || page.tagBox) }">
      <section v-if="page.table" class="ats-block">
        <table class="tagtable liste">
          <thead><tr class="liste_titre"><th v-for="header in page.table.headers" :key="header">{{ header }}</th></tr></thead>
          <tbody>
            <tr v-if="!(page.table.rows || []).length"><td :colspan="page.table.headers.length">{{ page.empty }}</td></tr>
            <tr v-for="row in page.table.rows" :key="row.row" :class="{ 'ats-hot': row.mark }">
              <td v-for="(cell, index) in row.cells" :key="index">
                <router-link v-if="index === 0 && row.row" :to="target({ section: row.section || page.section, row: row.row })">{{ cell }}</router-link>
                <template v-else>{{ cell }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="page.form" class="ats-block">
        <form data-verb="save" @submit.prevent="submit($event, page.form.fields)">
          <input type="hidden" name="form" :value="page.form.form" />
          <input type="hidden" name="row" :value="page.form.row || ''" />
          <input type="hidden" name="section" :value="page.section" />
          <table class="border">
            <tbody>
              <tr v-for="field in page.form.fields" :key="field.name">
                <td class="titlefield">{{ field.label }}</td>
                <td>
                  <RichEditor v-if="field.type === 'area' && field.name === 'description'" compact :name="field.name" :model-value="field.value || ''" />
                  <textarea v-else-if="field.type === 'area'" class="flat" :name="field.name" rows="4" :required="field.required">{{ field.value }}</textarea>
                  <select v-else-if="field.options" class="flat" :name="field.name" :required="field.required">
                    <option v-for="option in field.options" :key="`${field.name}-${option.value}`" :value="option.value" :selected="option.value === (field.value || '')">{{ option.label }}</option>
                  </select>
                  <input v-else-if="field.type === 'bool'" :name="field.name" type="checkbox" value="1" :checked="field.value === '1'" />
                  <input v-else class="flat" :name="field.name" :type="field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'" :value="field.value" :required="field.required" />
                </td>
              </tr>
              <tr v-if="page.form.confirm">
                <td class="titlefield">{{ page.labels.force }}</td>
                <td><input name="force" type="checkbox" value="1" /></td>
              </tr>
            </tbody>
          </table>
          <div class="tabsAction">
            <button class="butAction" type="submit">{{ page.labels.save }}</button>
            <button v-if="page.form.row && page.form.form !== 'settings' && page.form.form !== 'import'" class="butActionDelete" type="button" @click="call('remove', { form: page.form.form, row: page.form.row, section: page.section }).catch((cause) => { error.value = cause.message })">{{ page.labels.remove }}</button>
          </div>
        </form>
      </section>

      <div class="ats-side">
        <section v-if="page.pipeline" class="ats-block">
          <h3>{{ page.pipeline.title }}</h3>
          <form v-for="row in page.pipeline.rows" :key="row.candidate + '-' + row.job" data-verb="pipeline" class="ats-inline" @submit.prevent="submit">
            <input type="hidden" name="candidate" :value="row.candidate" />
            <input type="hidden" name="job" :value="row.job" />
            <input type="hidden" name="section" :value="page.section" />
            <input type="hidden" name="back" :value="page.pipeline.side" />
            <router-link :to="target({ section: row.section, row: row.row })">{{ row.label }}</router-link>
            <select class="flat" name="status">
              <option v-for="option in page.pipeline.statuses" :key="option.value" :value="option.value" :selected="option.value === row.status">{{ option.label }}</option>
            </select>
            <select class="flat" name="rating">
              <option v-for="score in ['0', '1', '2', '3', '4', '5']" :key="score" :value="score" :selected="score === String(row.rating || '0')">{{ score }}</option>
            </select>
            <button class="butAction" type="submit">{{ page.labels.save }}</button>
          </form>
          <form v-if="page.pipeline.choices?.length" data-verb="pipeline" class="ats-inline" @submit.prevent="submit">
            <input type="hidden" name="section" :value="page.section" />
            <input type="hidden" name="back" :value="page.pipeline.side" />
            <input v-if="page.pipeline.side === 'candidate'" type="hidden" name="candidate" :value="page.pipeline.anchor" />
            <input v-else type="hidden" name="job" :value="page.pipeline.anchor" />
            <select class="flat" :name="page.pipeline.side === 'candidate' ? 'job' : 'candidate'" required>
              <option v-for="option in page.pipeline.choices" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <select class="flat" name="status">
              <option v-for="option in page.pipeline.statuses" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <select class="flat" name="rating"><option v-for="score in ['0', '1', '2', '3', '4', '5']" :key="score">{{ score }}</option></select>
            <button class="butAction" type="submit">{{ page.labels.add }}</button>
          </form>
        </section>

        <section v-if="page.activity" class="ats-block">
          <h3>{{ page.activity.title }}</h3>
          <p class="ats-note">{{ page.activity.hint }}</p>
          <ul class="ats-feed">
            <li v-for="(row, index) in page.activity.rows" :key="index"><b>{{ row.date }} · {{ row.type }}</b> {{ row.notes }}</li>
          </ul>
          <form data-verb="activity" @submit.prevent="submit">
            <input type="hidden" name="kind" :value="page.activity.kind" />
            <input type="hidden" name="item" :value="page.activity.item" />
            <input type="hidden" name="section" :value="page.section" />
            <select class="flat" name="type">
              <option v-for="option in page.activity.types" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <select class="flat" name="template">
              <option v-for="option in page.activity.templates" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <input class="flat" name="date" type="date" />
            <textarea class="flat" name="notes" rows="3"></textarea>
            <div class="tabsAction"><button class="butAction" type="submit">{{ page.labels.add }}</button></div>
          </form>
        </section>

        <section v-if="page.files" class="ats-block">
          <h3>{{ page.files.title }}</h3>
          <ul class="ats-feed">
            <li v-for="file in page.files.rows" :key="file.node"><a :href="`/api/plugins/opencats/raw/${file.node}`">{{ file.name }}</a></li>
          </ul>
          <form @submit.prevent="upload">
            <input type="hidden" name="kind" :value="page.files.kind" />
            <input type="hidden" name="item" :value="page.files.item" />
            <input type="hidden" name="section" :value="page.section" />
            <input name="upload" type="file" required />
            <button class="butAction" type="submit">{{ page.labels.add }}</button>
          </form>
        </section>

        <section v-if="page.tagBox" class="ats-block">
          <h3>{{ page.tagBox.title }}</h3>
          <form v-if="page.tagBox.items?.length" data-verb="tags" @submit.prevent="submit">
            <input type="hidden" name="kind" :value="page.tagBox.kind" />
            <input type="hidden" name="item" :value="page.tagBox.item" />
            <input type="hidden" name="section" :value="page.section" />
            <label v-for="tag in page.tagBox.items" :key="tag.id" class="ats-check"><input name="tags" type="checkbox" :value="tag.id" :checked="tag.on" /> {{ tag.name }}</label>
            <div class="tabsAction"><button class="butAction" type="submit">{{ page.labels.save }}</button></div>
          </form>
          <p v-else class="ats-note">{{ page.empty }}</p>
        </section>

        <section v-if="page.listAdd?.choices?.length" class="ats-block">
          <h3>{{ page.listAdd.label }}</h3>
          <form data-verb="listAdd" class="ats-inline" @submit.prevent="submit">
            <input type="hidden" name="item" :value="page.row" />
            <select class="flat" name="list" required>
              <option v-for="option in page.listAdd.choices" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <button class="butAction" type="submit">{{ page.labels.add }}</button>
          </form>
        </section>
      </div>
    </div>

    <section v-for="block in page.related || []" :key="block.title" class="ats-block">
      <h3>{{ block.title }}</h3>
      <table class="tagtable liste">
        <thead><tr class="liste_titre"><th v-for="header in block.headers" :key="header">{{ header }}</th></tr></thead>
        <tbody>
          <tr v-if="!(block.rows || []).length"><td :colspan="block.headers.length">{{ page.empty }}</td></tr>
          <tr v-for="row in block.rows" :key="(row.row || row.cells.join('|'))">
            <td v-for="(cell, index) in row.cells" :key="index">
              <router-link v-if="index === 0 && row.row" :to="target({ section: row.section, row: row.row })">{{ cell }}</router-link>
              <template v-else>{{ cell }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
