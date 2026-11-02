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

async function load() {
  error.value = ''
  q.value = typeof route.query.q === 'string' ? route.query.q : ''
  const query = new URLSearchParams({
    offset: String(route.query.offset || 0),
    max: '15'
  })
  if (q.value) query.set('q', q.value)
  page.value = await api(`/api/screens/${route.params.id}?${query}`, { locale: locale.value })
}

function search() {
  const query = {}
  if (q.value) query.q = q.value
  router.push({ path: `/screens/${route.params.id}`, query })
}

function go(offset) {
  const query = { ...route.query }
  if (offset > 0) query.offset = String(offset)
  else delete query.offset
  router.push({ path: `/screens/${route.params.id}`, query })
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
    <div class="div-table-responsive">
      <table class="tagtable liste">
        <thead>
          <tr class="liste_titre">
            <th v-for="column in page.screen.columns" :key="column.name" class="liste_titre">{{ column.label }}</th>
            <th class="liste_titre"></th>
          </tr>
          <tr class="liste_titre_filter">
            <td :colspan="page.screen.columns.length + 1">
              <form class="inline-form" @submit.prevent="search">
                <input v-model="q" class="flat" type="search" :placeholder="nav.chrome['action.search']" />
                <button class="button" type="submit">{{ nav.chrome['action.search'] }}</button>
              </form>
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
              <template v-else>{{ row.labels[column.name] }}</template>
            </td>
            <td><router-link :to="`/screens/${page.screen.id}/${row.id}`">{{ nav.chrome['action.open'] }}</router-link></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="pagination">
      <button v-if="page.offset > 0" class="button" type="button" @click="go(page.offset - page.max)">{{ nav.chrome['action.previous'] }}</button>
      <span class="paginationtext">{{ range() }}</span>
      <button v-if="page.offset + page.max < page.total" class="button" type="button" @click="go(page.offset + page.max)">{{ nav.chrome['action.next'] }}</button>
    </div>
  </div>
</template>
