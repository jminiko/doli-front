<script setup>
import { computed, inject, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'
import SearchableSelect from '../components/SearchableSelect.vue'
import RichEditor from '../components/RichEditor.vue'

const props = defineProps({ page: { type: Object, required: true } })
const emit = defineEmits(['update'])
const locale = inject('locale')
const error = inject('error')
const route = useRoute()
const router = useRouter()
const mode = ref('source')
const showSite = ref(false)
const showPage = ref(false)
const draft = reactive({})
const labels = computed(() => props.page.labels || {})
const site = computed(() => (props.page.websites || []).find((item) => item.id === props.page.websiteId) || null)
const current = computed(() => props.page.page || null)
const siteOptions = computed(() => (props.page.websites || []).map((item) => ({
  value: String(item.id),
  label: `${item.ref} (${item.statusLabel || item.status})`
})))
const pageOptions = computed(() => (props.page.pages || []).map((item) => ({
  value: String(item.id),
  label: `${item.pageUrl}${item.home ? ' · ' + (labels.value.home || '') : ''}`
})))
const containerOptions = computed(() => props.page.containers || [])
const groupedPages = computed(() => (props.page.containers || []).map((container) => ({
  ...container,
  pages: (props.page.pages || []).filter((item) => item.typeContainer === container.value)
})).filter((group) => group.pages.length))
function containerLabel(kind) {
  const found = (props.page.containers || []).find((item) => item.value === kind)
  return found?.label || kind || 'page'
}
function containerIcon(kind) {
  switch (kind) {
    case 'blogpost': return 'bi bi-file-earmark-text'
    case 'menu': return 'bi bi-list-ul'
    case 'service': return 'bi bi-gear'
    case 'banner': return 'bi bi-image'
    case 'other': return 'bi bi-box'
    default: return 'bi bi-file-earmark'
  }
}
function text(value) {
  return String(value ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]))
}

const previewDoc = computed(() => {
  const body = draft.content || ''
  const css = text(draft.stylesheet || site.value?.stylesheet || '')
  const title = text(draft.title || current.value?.title || site.value?.ref || '')
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head><body>${body}</body></html>`
})

function sync() {
  const chosen = site.value || {}
  const row = current.value || {}
  Object.assign(draft, {
    ref: '',
    siteDescription: chosen.description || '',
    lang: chosen.lang || 'fr',
    otherLang: chosen.otherLang || '',
    virtualHost: chosen.virtualHost || '',
    mainColor: chosen.mainColor || '',
    mainColorBis: chosen.mainColorBis || '',
    useManifest: !!chosen.useManifest,
    stylesheet: chosen.stylesheet || '',
    nameTemplate: chosen.nameTemplate || '',
    newPageUrl: '',
    newTitle: '',
    pageUrl: row.pageUrl || '',
    title: row.title || '',
    pageDescription: row.description || '',
    typeContainer: row.typeContainer || 'page',
    aliasAlt: row.aliasAlt || '',
    keywords: row.keywords || '',
    image: row.image || '',
    authorAlias: row.authorAlias || '',
    grabbedFrom: row.grabbedFrom || '',
    allowedInFrames: !!row.allowedInFrames,
    htmlHeader: row.htmlHeader || '',
    content: row.content || '',
    fromText: '',
    toText: ''
  })
  if (current.value) {
    mode.value = 'source'
  }
  showSite.value = !site.value
}

watch(() => [props.page.websiteId, props.page.page?.id], sync, { immediate: true })

function selectSite(id) {
  router.push({ path: route.path, query: { websiteId: id } })
}

function selectPage(id) {
  mode.value = 'source'
  router.push({ path: route.path, query: { websiteId: props.page.websiteId, pageId: id } })
}

async function call(verb, extra = {}) {
  error.value = ''
  const result = await api(`/api/system/${props.page.id}`, {
    locale: locale.value,
    method: 'POST',
    headers: { 'X-CSRF-Token': props.page.csrf || '' },
    body: {
      verb,
      websiteId: props.page.websiteId,
      pageId: props.page.page?.id,
      ...extra
    }
  })
  emit('update', result)
}

async function upload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const data = new FormData()
  data.set('websiteId', String(props.page.websiteId || ''))
  data.set('pageId', String(props.page.page?.id || ''))
  data.set('file', file)
  const response = await fetch(`/api/website/media?lang=${encodeURIComponent(locale.value)}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRF-Token': props.page.csrf || '' },
    body: data
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'error')
  emit('update', result)
  event.target.value = ''
}

function removeSite() {
  if (window.confirm(labels.value.confirm || '')) call('deleteSite').catch((cause) => { error.value = cause.message })
}

function removePage() {
  if (window.confirm(labels.value.confirm || '')) call('deletePage').catch((cause) => { error.value = cause.message })
}
</script>

<template>
  <div class="website-studio">
    <div class="websitebar">
      <span>{{ labels.website }}</span>
      <SearchableSelect :model-value="site ? String(site.id) : ''" :options="siteOptions" :placeholder="labels.addWebsite" @update:model-value="selectSite" />
      <button type="button" class="website-icon" :title="labels.addWebsite" @click="showSite = !showSite"><i class="bi bi-plus-circle"></i></button>
      <button v-if="site" type="button" class="website-icon" :title="site.statusLabel" @click="call('toggleSite').catch((cause) => { error.value = cause.message })">
        <i :class="site.status === 'online' ? 'bi bi-toggle-on' : 'bi bi-toggle-off'"></i>
        {{ site.statusLabel }}
      </button>
      <button v-if="site" type="button" @click="mode = 'setup'">{{ labels.editCss }}</button>
      <button v-if="site" type="button" @click="mode = 'media'">{{ labels.medias }}</button>
      <a v-if="page.publicHome" class="butAction" :href="page.publicHome" target="_blank" rel="noopener">{{ labels.preview }}</a>
      <button v-if="site" type="button" class="butActionDelete" @click="removeSite">{{ labels.delete }}</button>
      <span v-if="site" class="opacitymedium">{{ labels.views }} : {{ site.pageViews }}</span>
    </div>

    <form v-if="showSite" class="website-create" @submit.prevent="call('createSite', { ref: draft.ref, description: draft.siteDescription, lang: draft.lang }).then(() => { showSite = false }).catch((cause) => { error.value = cause.message })">
      <input v-model="draft.ref" class="flat" required :placeholder="labels.ref" />
      <input v-model="draft.siteDescription" class="flat" :placeholder="labels.description" />
      <input v-model="draft.lang" class="flat website-lang" maxlength="8" :placeholder="labels.lang" />
      <button class="butAction" type="submit">{{ labels.addWebsite }}</button>
    </form>

    <p v-if="!site" class="opacitymedium">{{ labels.empty }}</p>

    <template v-else>
      <div class="websitebar">
        <span>{{ labels.page }}</span>
        <SearchableSelect :model-value="current ? String(current.id) : ''" :options="pageOptions" :placeholder="labels.addPage" @update:model-value="selectPage" />
        <button type="button" class="website-icon" :title="labels.addPage" @click="showPage = !showPage"><i class="bi bi-plus-circle"></i></button>
        <button v-if="current" type="button" @click="mode = 'source'">{{ labels.source }}</button>
        <button v-if="current" type="button" @click="mode = 'preview'">{{ labels.preview }}</button>
        <button v-if="current" type="button" @click="mode = 'meta'">{{ labels.meta }}</button>
        <button v-if="current" type="button" class="website-icon" :title="current.status" @click="call('togglePage').catch((cause) => { error.value = cause.message })">
          <i :class="current.status === 'online' ? 'bi bi-toggle-on' : 'bi bi-toggle-off'"></i>
        </button>
        <button v-if="current" type="button" @click="call('setHome').catch((cause) => { error.value = cause.message })">{{ labels.setHome }}</button>
        <button v-if="current" type="button" class="butActionDelete" @click="removePage">{{ labels.delete }}</button>
        <a v-if="page.previewPath && current?.status === 'online' && site.status === 'online'" :href="page.previewPath" target="_blank" rel="noopener">{{ page.previewPath }}</a>
      </div>

      <form v-if="showPage" class="website-create" @submit.prevent="call('createPage', { pageUrl: draft.newPageUrl, title: draft.newTitle, typeContainer: draft.typeContainer, lang: draft.lang }).then(() => { showPage = false; mode = 'source' }).catch((cause) => { error.value = cause.message })">
        <input v-model="draft.newPageUrl" class="flat" required :placeholder="labels.pageUrl" />
        <input v-model="draft.newTitle" class="flat" :placeholder="labels.title" />
        <SearchableSelect v-model="draft.typeContainer" :options="containerOptions" :search-threshold="20" />
        <button class="butAction" type="submit">{{ labels.addPage }}</button>
      </form>

      <div class="website-layout">
        <aside class="website-tree">
          <section v-for="group in groupedPages" :key="group.value">
            <h3>{{ group.label }}</h3>
            <button v-for="item in group.pages" :key="item.id" type="button" :class="{ selected: item.id === current?.id }" @click="selectPage(item.id)">
              <i :class="item.status === 'online' ? 'bi bi-circle-fill' : 'bi bi-circle'"></i>
              {{ item.pageUrl }}
              <em v-if="item.home">{{ labels.home }}</em>
            </button>
          </section>
        </aside>

        <div class="website-stage">
          <form v-if="mode === 'source' && current" class="website-editor" @submit.prevent="call('savePage', { content: draft.content, htmlHeader: draft.htmlHeader }).catch((cause) => { error.value = cause.message })">
            <div class="website-editor-head">
              <div class="website-editor-title">
                <i :class="containerIcon(current.typeContainer)"></i>
                <span>{{ containerLabel(current.typeContainer) }}</span>
                <em>{{ current.pageUrl }}</em>
              </div>
              <button class="butAction" type="submit">{{ labels.save }}</button>
            </div>
            <label>{{ labels.content }}</label>
            <RichEditor :key="'page-' + current.id" v-model="draft.content" />
            <div class="tabsAction"><button class="butAction" type="submit">{{ labels.save }}</button></div>
          </form>

          <iframe v-else-if="mode === 'preview'" class="website-preview" sandbox="" :srcdoc="previewDoc" :title="labels.preview"></iframe>

          <form v-else-if="mode === 'meta' && current" class="website-form" @submit.prevent="call('savePage', { pageUrl: draft.pageUrl, title: draft.title, typeContainer: draft.typeContainer, lang: draft.lang, aliasAlt: draft.aliasAlt, description: draft.pageDescription, keywords: draft.keywords, image: draft.image, authorAlias: draft.authorAlias, grabbedFrom: draft.grabbedFrom, allowedInFrames: draft.allowedInFrames, htmlHeader: draft.htmlHeader, content: draft.content }).catch((cause) => { error.value = cause.message })">
            <label>{{ labels.pageUrl }}<input v-model="draft.pageUrl" class="flat" :placeholder="current.pageUrl" /></label>
            <label>{{ labels.title }}<textarea v-model="draft.title" class="flat" rows="2"></textarea></label>
            <label>{{ labels.typeContainer }}<SearchableSelect v-model="draft.typeContainer" :options="containerOptions" :search-threshold="20" /></label>
            <label>{{ labels.lang }}<input v-model="draft.lang" class="flat" maxlength="8" /></label>
            <label>{{ labels.aliasAlt }}<textarea v-model="draft.aliasAlt" class="flat" rows="2"></textarea></label>
            <label>{{ labels.description }}<textarea v-model="draft.pageDescription" class="flat" rows="3"></textarea></label>
            <label>{{ labels.keywords }}<textarea v-model="draft.keywords" class="flat" rows="2"></textarea></label>
            <label>{{ labels.image }}<input v-model="draft.image" class="flat" /></label>
            <label>{{ labels.authorAlias }}<input v-model="draft.authorAlias" class="flat" maxlength="64" /></label>
            <label>{{ labels.grabbedFrom }}<input v-model="draft.grabbedFrom" class="flat" /></label>
            <fieldset>
              <legend>{{ labels.allowedInFrames }}</legend>
              <label><input v-model="draft.allowedInFrames" type="radio" :value="true" /> {{ labels.yes }}</label>
              <label><input v-model="draft.allowedInFrames" type="radio" :value="false" /> {{ labels.no }}</label>
            </fieldset>
            <label>{{ labels.htmlHeader }}<textarea v-model="draft.htmlHeader" class="flat" rows="4"></textarea></label>
            <div class="tabsAction"><button class="butAction" type="submit">{{ labels.save }}</button></div>
          </form>

          <form v-else-if="mode === 'setup'" class="website-form" @submit.prevent="call('saveSite', { ref: site.ref, description: draft.siteDescription, lang: draft.lang, otherLang: draft.otherLang, virtualHost: draft.virtualHost, mainColor: draft.mainColor, mainColorBis: draft.mainColorBis, useManifest: draft.useManifest, nameTemplate: draft.nameTemplate, stylesheet: draft.stylesheet }).catch((cause) => { error.value = cause.message })">
            <label>{{ labels.description }}<textarea v-model="draft.siteDescription" class="flat" rows="3"></textarea></label>
            <label>{{ labels.lang }}<input v-model="draft.lang" class="flat" maxlength="8" /></label>
            <label>{{ labels.otherLang }}<textarea v-model="draft.otherLang" class="flat" rows="2"></textarea></label>
            <label>{{ labels.virtualHost }}<input v-model="draft.virtualHost" class="flat" type="url" placeholder="https://" /></label>
            <label>{{ labels.mainColor }}<input v-model="draft.mainColor" class="flat" maxlength="16" placeholder="#5b6cff" /></label>
            <label>{{ labels.mainColorBis }}<input v-model="draft.mainColorBis" class="flat" maxlength="16" /></label>
            <label>{{ labels.nameTemplate }}<textarea v-model="draft.nameTemplate" class="flat" rows="2"></textarea></label>
            <fieldset>
              <legend>{{ labels.useManifest }}</legend>
              <label><input v-model="draft.useManifest" type="radio" :value="true" /> {{ labels.yes }}</label>
              <label><input v-model="draft.useManifest" type="radio" :value="false" /> {{ labels.no }}</label>
            </fieldset>
            <label>{{ labels.stylesheet }}<textarea v-model="draft.stylesheet" class="flat website-source" rows="8"></textarea></label>
            <div class="tabsAction"><button class="butAction" type="submit">{{ labels.save }}</button></div>
            <div class="website-replace">
              <h3>{{ labels.replace }}</h3>
              <input v-model="draft.fromText" class="flat" :placeholder="labels.from" />
              <input v-model="draft.toText" class="flat" :placeholder="labels.to" />
              <button class="butAction" type="button" @click="call('replaceContent', { fromText: draft.fromText, toText: draft.toText }).catch((cause) => { error.value = cause.message })">{{ labels.replace }}</button>
            </div>
          </form>

          <div v-else-if="mode === 'media'">
            <form @submit.prevent>
              <input type="file" @change="upload($event).catch((cause) => { error.value = cause.message })" />
            </form>
            <ul class="website-medias">
              <li v-for="media in page.medias || []" :key="media.id">
                <a :href="media.url" target="_blank" rel="noopener">{{ media.name }}</a>
                <button type="button" class="butActionDelete" @click="call('deleteMedia', { mediaId: media.id }).catch((cause) => { error.value = cause.message })">{{ labels.delete }}</button>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
