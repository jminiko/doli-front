<script setup>
import { inject, onMounted, ref } from 'vue'
import { api, assertFormSize } from '../api'

const locale = inject('locale')
const nav = inject('nav')
const error = inject('error')
const reloadNav = inject('reloadNav')
const modules = ref([])

async function load() {
  modules.value = (await api('/api/modules', { locale: locale.value })).modules
}

async function toggle(code) {
  modules.value = (await api(`/api/modules/${code}/toggle`, { locale: locale.value, method: 'POST' })).modules
  await reloadNav()
}

async function install(event) {
  assertFormSize(event.target, nav.value)
  const data = new FormData(event.target)
  const response = await fetch(`/api/modules/install?lang=${encodeURIComponent(locale.value)}`, {
    method: 'POST',
    credentials: 'include',
    body: data
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || response.statusText)
  modules.value = payload.modules
  event.target.reset()
  await reloadNav()
}

async function uninstall(code) {
  if (!window.confirm(nav.value?.chrome?.['action.confirmDelete'] || '')) return
  modules.value = (await api(`/api/modules/${code}/remove`, { locale: locale.value, method: 'POST' })).modules
  await reloadNav()
}

onMounted(() => load().catch((cause) => { error.value = cause.message }))
</script>

<template>
  <table class="table-fiche-title">
    <tbody>
      <tr class="toptitle">
        <td class="col-title"><div class="titre"><i class="bi bi-puzzle"></i>{{ nav.menus.flatMap((menu) => menu.entries).find((entry) => entry.target === 'modules')?.label }}</div></td>
      </tr>
    </tbody>
  </table>
  <form class="tabBar module-install" @submit.prevent="install($event).catch((cause) => { error.value = cause.message })">
    <input class="flat" type="file" name="module" accept=".zip,application/zip" required />
    <button class="butAction" type="submit">{{ nav.chrome['action.install'] }}</button>
  </form>
  <div class="box-grid">
    <article v-for="(module, index) in modules" :key="module.code" class="info-box">
      <span class="info-box-icon" :class="'bg' + ((index % 6) + 1)"><i :class="['bi', module.icon || 'bi-puzzle']"></i></span>
      <div class="info-box-content">
        <span class="info-box-title">{{ module.family }}</span>
        <strong>{{ module.title }}</strong>
        <p class="info-box-text">{{ module.description }}</p>
        <p class="opacitymedium">{{ nav.chrome['action.dependencies'] }} : {{ module.dependsOn.join(', ') || '-' }}<template v-if="module.external"> · {{ nav.chrome['module.external'] }} {{ module.version }}</template></p>
        <p v-if="module.setup"><router-link :to="`/system/${module.setup}`">{{ nav.chrome['action.configure'] }}</router-link></p>
        <button class="butAction" type="button" :disabled="module.required" @click="toggle(module.code).catch((cause) => { error.value = cause.message })">
          {{ module.enabled ? nav.chrome['action.disable'] : nav.chrome['action.enable'] }}
        </button>
        <button v-if="module.external" class="butActionDelete" type="button" @click="uninstall(module.code).catch((cause) => { error.value = cause.message })">{{ nav.chrome['action.uninstall'] }}</button>
      </div>
    </article>
  </div>
</template>
