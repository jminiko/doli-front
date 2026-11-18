<script setup>
import { inject, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'

const route = useRoute()
const router = useRouter()
const locale = inject('locale')
const nav = inject('nav')
const error = inject('error')
const iconFor = inject('iconFor')
const page = ref(null)
const q = ref(typeof route.query.q === 'string' ? route.query.q : '')
const filters = ref({})

function textQuery(value) {
  return typeof value === 'string' ? value : ''
}

function readFilters(columns) {
  const next = {}
  for (const column of columns || []) {
    next[column.name] = textQuery(route.query[`filter_${column.name}`])
  }
  filters.value = next
}

function keptQuery(extra = {}) {
  const query = {}
  if (q.value) query.q = q.value
  if (typeof route.query.sort === 'string') {
    query.sort = route.query.sort
    query.order = route.query.order === 'desc' ? 'desc' : 'asc'
  }
  for (const [name, value] of Object.entries(filters.value)) {
    if (value) query[`filter_${name}`] = value
  }
  Object.entries(extra).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') delete query[key]
    else query[key] = value
  })
  return query
}

async function load() {
  error.value = ''
  q.value = textQuery(route.query.q)
  const query = new URLSearchParams({
    offset: String(route.query.offset || 0),
    max: '15'
  })
  if (q.value) query.set('q', q.value)
  if (typeof route.query.sort === 'string') {
    query.set('sort', route.query.sort)
    query.set('order', route.query.order === 'desc' ? 'desc' : 'asc')
  }
  Object.entries(route.query).forEach(([key, value]) => {
    if (key.startsWith('filter_') && typeof value === 'string' && value) query.set(key, value)
  })
  page.value = await api(`/api/screens/${route.params.id}?${query}`, { locale: locale.value })
  readFilters(page.value?.screen?.columns)
}

function search() {
  router.push({ path: `/screens/${route.params.id}`, query: keptQuery({ sort: route.query.sort, order: route.query.order, offset: null }) })
}

function chooseFilter(name, value) {
  filters.value = { ...filters.value, [name]: value }
  search()
}

function clearFilters() {
  filters.value = Object.fromEntries(Object.keys(filters.value).map((name) => [name, '']))
  const query = {}
  if (q.value) query.q = q.value
  if (typeof route.query.sort === 'string') {
    query.sort = route.query.sort
    query.order = route.query.order === 'desc' ? 'desc' : 'asc'
  }
  router.push({ path: `/screens/${route.params.id}`, query })
}

function toggleSort(column) {
  const active = route.query.sort === column.name
  const order = active && route.query.order !== 'desc' ? 'desc' : 'asc'
  router.push({
    path: `/screens/${route.params.id}`,
    query: keptQuery({ sort: column.name, order, offset: null })
  })
}

function go(offset) {
  router.push({
    path: `/screens/${route.params.id}`,
    query: keptQuery({ offset: offset > 0 ? String(offset) : null })
  })
}

function badgeClass(status) {
  const key = String(status || '').toLowerCase()
  return key ? `badge badge-${key}` : 'badge'
}

function range() {
  if (!page.value?.total) return ''
  const start = page.value.offset + 1
  const end = Math.min(page.value.offset + page.value.rows.length, page.value.total)
  return `${start}-${end} / ${page.value.total}`
}

onMounted(() => load().catch((cause) => { error.value = cause.message }))
watch(() => route.fullPath, () => load().catch((cause) => { error.value = cause.message }))
</script>

<template>
  <div v-if="page">
    <table class="table-fiche-title">
      <tbody>
        <tr class="toptitle">
          <td class="col-title">
            <div class="titre"><i :class="['bi', iconFor(page.screen.id)]"></i>{{ page.screen.title }}</div>
          </td>
          <td class="col-right">
            <router-link v-if="page.screen.creatable !== false" class="butActionNew" :to="`/screens/${page.screen.id}/new`">
              <i class="bi bi-plus-circle"></i> {{ nav.chrome['action.new'] }}
            </router-link>
          </td>
        </tr>
      </tbody>
    </table>
    <form @submit.prevent="search">
      <div class="div-table-responsive">
        <table class="tagtable liste">
          <thead>
            <tr class="liste_titre">
              <th v-for="column in page.screen.columns" :key="column.name" class="liste_titre">
                <a v-if="column.sortable" href="#" @click.prevent="toggleSort(column)">
                  {{ column.label }}
                  <i v-if="page.sort === column.name" :class="['bi', page.order === 'desc' ? 'bi-caret-down-fill' : 'bi-caret-up-fill']"></i>
                </a>
                <template v-else>{{ column.label }}</template>
              </th>
              <th class="liste_titre"></th>
            </tr>
            <tr class="liste_titre_filter">
              <td v-for="column in page.screen.columns" :key="column.name">
                <select v-if="column.filter === 'select'" class="flat" :value="filters[column.name] || ''" @change="chooseFilter(column.name, $event.target.value)">
                  <option value=""></option>
                  <option v-for="option in column.options" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
                <select v-else-if="column.filter === 'bool'" class="flat" :value="filters[column.name] || ''" @change="chooseFilter(column.name, $event.target.value)">
                  <option value=""></option>
                  <option value="true">{{ nav.chrome['action.yes'] }}</option>
                  <option value="false">{{ nav.chrome['action.no'] }}</option>
                </select>
                <input v-else v-model="filters[column.name]" class="flat" type="search" />
              </td>
              <td class="liste_filter_actions">
                <button class="button" type="submit" :title="nav.chrome['action.search']"><i class="bi bi-search"></i></button>
                <button class="button" type="button" :title="nav.chrome['action.cancel']" @click="clearFilters"><i class="bi bi-x-lg"></i></button>
              </td>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!page.rows.length">
              <td :colspan="page.screen.columns.length + 1" class="opacitymedium">{{ nav.chrome['action.empty'] }}</td>
            </tr>
            <tr v-for="row in page.rows" :key="row.id" class="oddeven">
              <td v-for="column in page.screen.columns" :key="column.name">
                <span v-if="column.type === 'enum' || column.name === 'status'" :class="badgeClass(row.values?.[column.name] || row.status)">{{ row.labels[column.name] }}</span>
                <router-link v-else-if="column.name === 'name' || column.name === 'ref'" :to="`/screens/${page.screen.id}/${row.id}`">{{ row.labels[column.name] }}</router-link>
                <template v-else>{{ row.labels[column.name] }}</template>
              </td>
              <td><router-link :to="`/screens/${page.screen.id}/${row.id}`">{{ nav.chrome['action.open'] }}</router-link></td>
            </tr>
          </tbody>
        </table>
      </div>
    </form>
    <div class="pagination">
      <button v-if="page.offset > 0" class="button" type="button" @click="go(page.offset - page.max)">{{ nav.chrome['action.previous'] }}</button>
      <span class="paginationtext">{{ range() }}</span>
      <button v-if="page.offset + page.max < page.total" class="button" type="button" @click="go(page.offset + page.max)">{{ nav.chrome['action.next'] }}</button>
    </div>
  </div>
</template>
