<script setup>
import { computed, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, ensureUser, remember } from './api'
import { groupOpen, href, matches, menuFolds, visibleEntries } from './nav'

const route = useRoute()
const router = useRouter()
const locale = ref(localStorage.getItem('atelier.locale') || 'fr')
const nav = ref({ menus: [], languages: [], chrome: {} })
const account = ref(null)
const error = ref('')
const menuOpen = ref(false)
const sideQuery = ref('')

async function load() {
  try {
    nav.value = await api('/api/navigation', { locale: locale.value })
    account.value = await ensureUser()
  } catch (cause) {
    error.value = cause.message
  }
}

async function logout() {
  await api('/api/logout', { method: 'POST', locale: locale.value })
  remember(null)
  window.location.assign('/login')
}

function menuTo(menu) {
  return href(menu.link) || '/'
}

function entryMatches(entry) {
  return matches(entry, route.path)
}

function isActiveMenu(menu) {
  if (matches(menu.link, route.path)) return true
  return (menu.groups || []).some((group) => matches(group.link, route.path) || group.entries.some(entryMatches))
}

const activeMenu = computed(() => (nav.value.menus || []).find(isActiveMenu))

function iconFor(screen) {
  for (const menu of nav.value.menus || []) {
    const entry = menu.entries.find((item) => item.id === screen)
    if (entry?.icon) return entry.icon
  }
  return 'bi-speedometer2'
}

function chooseLocale(event) {
  locale.value = event.target.value
}

function searchSide() {
  if (!route.path.startsWith('/screens/')) return
  const query = {}
  if (sideQuery.value) query.q = sideQuery.value
  router.push({ path: `/screens/${route.params.id}`, query })
  menuOpen.value = false
}

watch(locale, (value) => {
  localStorage.setItem('atelier.locale', value)
  load()
})

watch(() => route.path, (path) => {
  if (path !== '/login') load()
}, { immediate: true })

watch(() => route.fullPath, () => {
  sideQuery.value = typeof route.query.q === 'string' ? route.query.q : ''
  menuOpen.value = false
})
provide('locale', locale)
provide('nav', nav)
provide('error', error)
provide('reloadNav', load)
provide('iconFor', iconFor)
</script>

<template>
  <router-view v-if="route.path === '/login'" />
  <div v-else id="id-container" :class="{ 'sidebar-open': menuOpen }">
    <header id="id-top" class="side-nav-vert">
      <div id="tmenu_tooltip">
        <div class="tmenudiv">
          <ul class="tmenu" role="navigation">
            <li class="tmenu menuhider" id="mainmenutd_menu">
              <button class="tmenuimage" type="button" aria-label="menu" @click="menuOpen = !menuOpen">
                <i class="bi bi-list"></i>
              </button>
            </li>
            <li class="tmenu tmenucompanylogo" id="mainmenutd_companylogo">
              <router-link class="tmenuimage" to="/">
                <span class="mainmenuaspan">{{ nav.chrome['app.name'] || 'Atelier' }}</span>
              </router-link>
            </li>
            <li v-for="menu in nav.menus" :key="menu.id" :id="'mainmenutd_' + menu.id" :class="isActiveMenu(menu) ? 'tmenusel' : 'tmenu'">
              <router-link class="tmenuimage" :to="menuTo(menu)">
                <i :class="['bi', menu.icon || 'bi-grid']"></i>
                <span class="mainmenuaspan">{{ menu.label }}</span>
              </router-link>
            </li>
          </ul>
        </div>
      </div>
      <div class="login_block">
        <select :value="locale" aria-label="language" @change="chooseLocale">
          <option v-for="language in nav.languages" :key="language.code" :value="language.code">{{ language.name }}</option>
        </select>
        <span v-if="account" class="login-name">{{ account.login }}</span>
        <button v-if="account" class="login-out" type="button" @click="logout">{{ nav.chrome['auth.signOut'] }}</button>
        <a href="http://localhost:8080">{{ nav.chrome['gsp.link'] }}</a>
      </div>
    </header>
    <div class="below">
      <div class="side-nav">
        <div id="id-left">
          <div class="vmenu">
            <form class="blockvmenusearch" @submit.prevent="searchSide">
              <input v-model="sideQuery" class="vmenusearch" type="search" :placeholder="nav.chrome['action.search'] || 'Search'" />
            </form>
            <div v-if="activeMenu?.groups?.length" class="vmenu-blocks">
              <div v-for="(group, index) in activeMenu.groups" :key="group.id" class="blockvmenu" :class="[index % 2 ? 'blockvmenupair' : 'blockvmenuimpair', { open: groupOpen(group, route.path) }]">
                <div class="menu_titre">
                  <router-link v-if="href(group.link)" class="vmenu" :class="{ vmenusel: matches(group.link, route.path) }" :to="href(group.link)">
                    <i :class="['bi', group.icon || 'bi-folder']"></i><span>{{ group.label }}</span>
                    <i v-if="menuFolds(group)" class="bi bi-chevron-right vmenu-caret"></i>
                  </router-link>
                  <span v-else class="vmenu"><i :class="['bi', group.icon || 'bi-folder']"></i><span>{{ group.label }}</span>
                    <i v-if="menuFolds(group)" class="bi bi-chevron-right vmenu-caret"></i>
                  </span>
                </div>
                <div class="menu_top"></div>
                <div v-for="entry in visibleEntries(group, route.path)" :key="entry.id" class="menu_contenu" :class="'level-' + entry.level">
                  <span v-if="entry.heading" class="vsmenu-label">{{ entry.label }}</span>
                  <router-link v-else class="vsmenu" :class="{ vsmenusel: matches(entry, route.path) }" :to="href(entry)">
                    {{ entry.label }}
                    <i v-if="entry.warning" class="bi bi-exclamation-triangle-fill menu-warn"></i>
                  </router-link>
                </div>
                <div class="menu_end"></div>
              </div>
            </div>
            <div class="blockvmenuhelp">
              <div>{{ nav.chrome['app.name'] }}</div>
              <div>{{ nav.chrome['app.tagline'] }}</div>
            </div>
          </div>
        </div>
      </div>
      <div id="id-right">
        <div class="fiche">
          <p v-if="error" class="error">{{ error }}</p>
          <router-view :key="locale + route.fullPath" />
        </div>
      </div>
    </div>
  </div>
</template>
