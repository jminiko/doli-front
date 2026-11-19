<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, ensureUser, httpBusy, remember } from './api'
import { groupOpen, href, matches, menuFolds, visibleEntries } from './nav'
import SearchableSelect from './components/SearchableSelect.vue'

const route = useRoute()
const router = useRouter()
const locale = ref(localStorage.getItem('atelier.locale') || 'fr')
const nav = ref({ menus: [], languages: [], chrome: {} })
const account = ref(null)
const error = ref('')
const languageOptions = computed(() => (nav.value.languages || []).map((language) => ({ value: language.code, label: language.name })))
const menuOpen = ref(false)
const sideQuery = ref('')
const topbar = ref(null)
const moreOpen = ref(false)
const hiddenIds = ref([])
const overflowMenus = computed(() => {
  const hidden = new Set(hiddenIds.value)
  return (nav.value.menus || []).filter((menu) => hidden.has(String(menu.id)))
})
const moreSelected = computed(() => overflowMenus.value.some(isActiveMenu))

function fitTopMenu() {
  const bar = topbar.value
  if (!bar || bar.clientWidth < 1) return
  const items = [...bar.querySelectorAll('[data-top-item]')]
  const more = bar.querySelector('.tmenu-more')
  const wasHidden = more?.hidden
  items.forEach((item) => { item.style.display = 'block' })
  if (more) {
    more.hidden = false
    more.style.display = 'block'
  }
  const moreWidth = more?.offsetWidth || 76
  const fixed = [...bar.querySelectorAll('[data-fixed]')].reduce((sum, item) => sum + item.offsetWidth, 0)
  const widths = new Map(items.map((item) => [item.dataset.id, item.offsetWidth]))
  items.forEach((item) => { item.style.display = '' })
  if (more) {
    more.style.display = ''
    more.hidden = wasHidden
  }
  const available = bar.clientWidth
  function pack(reserve) {
    let used = fixed
    const shown = []
    const dropped = []
    for (const item of items) {
      const width = widths.get(item.dataset.id) || 0
      if (used + width <= available - reserve) {
        shown.push(item.dataset.id)
        used += width
      } else dropped.push(item.dataset.id)
    }
    return { shown, dropped }
  }
  let packed = pack(0)
  if (packed.dropped.length) packed = pack(moreWidth)
  const active = (nav.value.menus || []).find(isActiveMenu)
  if (active && packed.dropped.includes(String(active.id))) {
    const dropped = packed.dropped.filter((id) => id !== String(active.id))
    const shown = [...packed.shown]
    let used = fixed + shown.reduce((sum, id) => sum + (widths.get(id) || 0), 0)
    const activeWidth = widths.get(String(active.id)) || 0
    while (shown.length && used + activeWidth > available - moreWidth) {
      const removed = shown.pop()
      used -= widths.get(removed) || 0
      dropped.push(removed)
    }
    if (used + activeWidth <= available - moreWidth) shown.push(String(active.id))
    else dropped.push(String(active.id))
    packed = { shown, dropped }
  }
  const next = packed.dropped
  if (next.join('|') !== hiddenIds.value.join('|')) hiddenIds.value = next
  bar.classList.add('tmenu-fitted')
}

function closeMore() {
  moreOpen.value = false
}

function onDocumentClick(event) {
  if (!event.target.closest?.('.tmenu-more')) closeMore()
}

function onEscape(event) {
  if (event.key === 'Escape') closeMore()
}

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
  return matches(entry, route.fullPath)
}

function isActiveMenu(menu) {
  if (matches(menu.link, route.fullPath)) return true
  return (menu.groups || []).some((group) => matches(group.link, route.fullPath) || group.entries.some(entryMatches))
}

const activeMenu = computed(() => (nav.value.menus || []).find(isActiveMenu))

function iconFor(screen) {
  for (const menu of nav.value.menus || []) {
    const entry = menu.entries.find((item) => item.id === screen)
    if (entry?.icon) return entry.icon
  }
  return 'bi-speedometer2'
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
  if (path !== '/login' && path !== '/careers') load()
}, { immediate: true })

watch(() => route.fullPath, () => {
  sideQuery.value = typeof route.query.q === 'string' ? route.query.q : ''
  menuOpen.value = false
  closeMore()
  nextTick(fitTopMenu)
})

watch(() => (nav.value.menus || []).map((menu) => menu.label).join('|'), () => nextTick(fitTopMenu))

let topObserver
onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onEscape)
  if (topbar.value && window.ResizeObserver) {
    topObserver = new ResizeObserver(() => fitTopMenu())
    topObserver.observe(topbar.value)
  }
  fitTopMenu()
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onEscape)
  topObserver?.disconnect()
})

watch(() => nav.value?.theme, (href) => {
  const link = document.getElementById('active-theme')
  if (!href) {
    link?.remove()
    return
  }
  const node = link || document.createElement('link')
  node.id = 'active-theme'
  node.rel = 'stylesheet'
  if (!link) document.head.appendChild(node)
  if (!node.getAttribute('href')?.endsWith(href)) node.href = href
}, { immediate: true })
provide('locale', locale)
provide('nav', nav)
provide('error', error)
provide('reloadNav', load)
provide('iconFor', iconFor)
</script>

<template>
  <div v-if="httpBusy" class="http-wait" role="status" aria-live="polite" aria-busy="true">
    <span class="http-wait-spin"></span>
  </div>
  <router-view v-if="route.path === '/login' || route.path === '/careers'" />
  <div v-else id="id-container" :class="{ 'sidebar-open': menuOpen }">
    <header id="id-top" class="side-nav-vert">
      <div id="tmenu_tooltip">
        <div class="tmenudiv">
          <ul class="tmenu" role="navigation" ref="topbar">
            <li class="tmenu menuhider" id="mainmenutd_menu" data-fixed>
              <button class="tmenuimage" type="button" aria-label="menu" @click="menuOpen = !menuOpen">
                <i class="bi bi-list"></i>
              </button>
            </li>
            <li class="tmenu tmenucompanylogo" id="mainmenutd_companylogo" data-fixed>
              <router-link class="tmenuimage" to="/">
                <span class="mainmenuaspan">{{ nav.chrome['app.name'] || 'Atelier' }}</span>
              </router-link>
            </li>
            <li v-for="menu in nav.menus" :key="menu.id" :id="'mainmenutd_' + menu.id" data-top-item :data-id="menu.id" :class="[isActiveMenu(menu) ? 'tmenusel' : 'tmenu', { 'tmenu-collapsed': hiddenIds.includes(String(menu.id)) }]">
              <router-link class="tmenuimage" :to="menuTo(menu)">
                <i :class="['bi', menu.icon || 'bi-grid']"></i>
                <span class="mainmenuaspan">{{ menu.label }}</span>
              </router-link>
            </li>
            <li class="tmenu tmenu-more" :class="{ 'is-open': moreOpen, tmenusel: moreSelected }" :hidden="!overflowMenus.length">
              <button class="tmenuimage" type="button" aria-haspopup="true" :aria-expanded="moreOpen" aria-controls="tmenu-overflow" @click.stop="moreOpen = !moreOpen">
                <i class="bi bi-three-dots"></i>
                <span class="mainmenuaspan">{{ nav.chrome['menu.more'] || 'Plus' }}</span>
              </button>
              <ul class="tmenu-overflow" id="tmenu-overflow">
                <li v-for="menu in overflowMenus" :key="menu.id" :class="{ tmenusel: isActiveMenu(menu) }">
                  <router-link class="tmenuimage" :to="menuTo(menu)" @click="closeMore">
                    <i :class="['bi', menu.icon || 'bi-grid']"></i>
                    <span class="mainmenuaspan">{{ menu.label }}</span>
                  </router-link>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
      <div class="login_block">
        <SearchableSelect class="ss-locale" :model-value="locale" :options="languageOptions" @update:model-value="locale = $event" :placeholder="''" />
        <span v-if="account" class="login-name">{{ account.login }}</span>
        <button v-if="account" class="login-out" type="button" @click="logout">{{ nav.chrome['auth.signOut'] }}</button>
        <a v-if="nav.gsp" href="http://localhost:8080">{{ nav.chrome['gsp.link'] }}</a>
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
              <div v-for="(group, index) in activeMenu.groups" :key="group.id" class="blockvmenu" :class="[index % 2 ? 'blockvmenupair' : 'blockvmenuimpair', { open: groupOpen(group, route.fullPath) }]">
                <div class="menu_titre">
                  <router-link v-if="href(group.link)" class="vmenu" :class="{ vmenusel: matches(group.link, route.fullPath) }" :to="href(group.link)">
                    <i :class="['bi', group.icon || 'bi-folder']"></i><span>{{ group.label }}</span>
                    <i v-if="menuFolds(group)" class="bi bi-chevron-right vmenu-caret"></i>
                  </router-link>
                  <span v-else class="vmenu"><i :class="['bi', group.icon || 'bi-folder']"></i><span>{{ group.label }}</span>
                    <i v-if="menuFolds(group)" class="bi bi-chevron-right vmenu-caret"></i>
                  </span>
                </div>
                <div class="menu_top"></div>
                <div v-for="entry in visibleEntries(group, route.fullPath)" :key="entry.id" class="menu_contenu" :class="'level-' + entry.level">
                  <span v-if="entry.heading" class="vsmenu-label">{{ entry.label }}</span>
                  <router-link v-else class="vsmenu" :class="{ vsmenusel: matches(entry, route.fullPath) }" :to="href(entry)">
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
