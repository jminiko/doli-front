<script setup>
import { computed, inject, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api, assertFormSize } from '../api'
import CatalogForm from '../components/CatalogForm.vue'
import FileUpload from '../components/FileUpload.vue'
import RichEditor from '../components/RichEditor.vue'
import SearchableSelect from '../components/SearchableSelect.vue'
import ThirdPartyCard from '../components/ThirdPartyCard.vue'
import ThirdPartyForm from '../components/ThirdPartyForm.vue'
import WarehouseForm from '../components/WarehouseForm.vue'

const route = useRoute()
const router = useRouter()
const locale = inject('locale')
const nav = inject('nav')
const error = inject('error')
const iconFor = inject('iconFor')
const form = ref(null)
const values = reactive({})
const line = reactive({ product: '', description: '', qty: '1', unitPrice: '', vatRate: '' })
const password = ref('')
const trayLink = ref('')
const picked = ref('')
const pickedFile = computed(() => form.value?.tray?.files?.find((file) => file.id === picked.value))
const draft = reactive({})

function fill(payload) {
  form.value = payload
  Object.keys(values).forEach((key) => delete values[key])
  Object.assign(values, payload.row.values || {})
  Object.keys(draft).forEach((key) => delete draft[key])
  Object.entries(payload.panel?.editor?.values || {}).forEach(([key, value]) => { draft[key] = value == null ? '' : value })
  if (!route.params.rowId) {
    if (route.query.thirdParty) values.thirdParty = String(route.query.thirdParty)
    if (route.query.project) values.project = String(route.query.project)
  }
  if (payload.screen?.layout === 'service' || payload.screen?.layout === 'product') {
    if (!values.saleStatus) values.saleStatus = 'onsale'
    if (!values.buyStatus) values.buyStatus = 'onbuy'
    if (!values.priceBasis) values.priceBasis = 'ht'
    values.vatRate = String(values.vatRate ?? '20').replace(/\.0$/, '')
    values.dateRangeRequired = values.dateRangeRequired === true || values.dateRangeRequired === 'true'
  }
  if (payload.screen?.layout === 'service' && !values.durationUnit) values.durationUnit = 'hour'
  if (payload.screen?.layout === 'product') {
    if (!values.batchMode) values.batchMode = 'nobatch'
    if (!values.sellByMode) values.sellByMode = 'nobylimit'
    if (!values.barcodeType) values.barcodeType = 'nobarcode'
    if (!values.nature) values.nature = 'finished'
    if (!values.weightUnit) values.weightUnit = 'kg'
    if (!values.sizeUnit) values.sizeUnit = 'm'
    if (!values.surfaceUnit) values.surfaceUnit = 'm2'
    if (!values.volumeUnit) values.volumeUnit = 'm3'
  }
  if (payload.screen?.layout === 'warehouse' && !values.status) values.status = 'open'
  for (const field of payload.screen?.fields || []) {
    if (field.type === 'boolean') {
      const current = values[field.name]
      values[field.name] = current == null || current === '' ? null : current === true || current === 'true'
    } else if (field.multiple) {
      const current = values[field.name]
      values[field.name] = Array.isArray(current) ? current.map(String) : (current ? [String(current)] : [])
    } else if (values[field.name] == null) {
      values[field.name] = ''
    } else if (field.type === 'ref' || field.type === 'enum') {
      values[field.name] = String(values[field.name])
    }
  }
  if (payload.screen?.layout === 'thirdparty') {
    const status = values.customerStatus || 'none'
    values.prospect = status === 'prospect' || status === 'both'
    values.customer = status === 'customer' || status === 'both'
    values.supplier = values.supplier === true
    values.noEmail = values.noEmail === true
    values.vatSubject = values.vatSubject === true
    if (!values.country) values.country = 'FR'
    if (!values.currency) values.currency = 'EUR'
    if (!values.status) values.status = 'open'
  }
  if (payload.screen.layout === 'project') {
    ;['usageOpportunity', 'usageTask', 'usageBillTime', 'shared'].forEach((name) => {
      values[name] = values[name] === true || values[name] === 'true'
    })
    ;['ref', 'title', 'oppStatus', 'oppPercent', 'oppAmount', 'budget', 'dateStart', 'dateEnd', 'description', 'thirdParty'].forEach((name) => {
      if (values[name] == null) values[name] = ''
    })
  }
}

async function load() {
  const query = new URLSearchParams()
  if (route.query.tab) query.set('tab', route.query.tab)
  if (route.query.item) query.set('item', route.query.item)
  const suffix = query.toString() ? `?${query}` : ''
  const path = route.params.rowId
    ? `/api/screens/${route.params.id}/${route.params.rowId}${suffix}`
    : `/api/screens/${route.params.id}/new`
  fill(await api(path, { locale: locale.value }))
}

async function commitTab(op, itemId) {
  const body = { ...draft, op, itemId }
  fill(await api(`/api/screens/${route.params.id}/${route.params.rowId}/tab/${form.value.activeTab}`, { locale: locale.value, method: 'POST', body }))
  if (op === 'create') {
    await router.replace({ path: route.path, query: { tab: route.query.tab } })
  }
}

const permOpen = ref({})

function moduleOpen(code) {
  return permOpen.value[code] !== false
}

function toggleModule(code) {
  permOpen.value = { ...permOpen.value, [code]: !moduleOpen(code) }
}

function setModules(open) {
  const next = {}
  for (const mod of form.value?.panel?.editor?.permissions?.modules || []) next[mod.code] = open
  permOpen.value = next
}

async function setRight(op, extra) {
  fill(await api(`/api/screens/${route.params.id}/${route.params.rowId}/tab/${form.value.activeTab}`, {
    locale: locale.value,
    method: 'POST',
    body: { op, ...extra }
  }))
}

async function uploadTab(event) {
  assertFormSize(event.target, nav.value)
  const data = new FormData(event.target)
  data.set('op', 'create')
  const response = await fetch(`/api/screens/${route.params.id}/${route.params.rowId}/tab/${form.value.activeTab}?lang=${encodeURIComponent(locale.value)}`, {
    method: 'POST',
    credentials: 'include',
    body: data
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error || response.statusText)
  fill(payload)
  event.target.reset()
}

async function trayAct(verb, extra) {
  const result = await api(`/api/plugins/filemanager/${verb}`, {
    locale: locale.value,
    method: 'POST',
    body: { ...extra, folder: form.value.tray.folder, ownerType: form.value.tray.ownerType, ownerId: form.value.tray.ownerId }
  })
  trayLink.value = result.link || ''
  await load()
}

async function removeTab(line) {
  if (!window.confirm(nav.value?.chrome?.['action.confirmDelete'] || '')) return
  fill(await api(`/api/screens/${route.params.id}/${route.params.rowId}/tab/${form.value.activeTab}`, {
    locale: locale.value,
    method: 'POST',
    body: { op: line.remove || 'delete', itemId: line.itemId }
  }))
}

function tabTo(item) {
  const query = {}
  if (item.code !== form.value?.tabs?.[0]?.code) {
    query.tab = item.code
  }
  return { path: `/screens/${route.params.id}/${route.params.rowId}`, query }
}

async function save() {
  const body = { ...values }
  if (form.value.screen.id === 'users' && password.value) {
    body.password = password.value
  }
  const saved = route.params.rowId
    ? await api(`/api/screens/${route.params.id}/${route.params.rowId}`, { locale: locale.value, method: 'PUT', body })
    : await api(`/api/screens/${route.params.id}`, { locale: locale.value, method: 'POST', body })
  password.value = ''
  if (form.value.screen.layout === 'project' || form.value.screen.layout === 'thirdparty') {
    await router.replace({ path: `/screens/${route.params.id}/${saved.row.id}`, query: {} })
  } else if (!route.params.rowId) {
    await router.replace(`/screens/${route.params.id}/${saved.row.id}`)
  }
  fill(saved)
}

async function transit(target) {
  fill(await api(`/api/screens/${route.params.id}/${route.params.rowId}/transition/${target}`, { locale: locale.value, method: 'POST' }))
}

async function remove() {
  const tasks = form.value.tasks?.length || 0
  const base = nav.value.chrome['action.confirmDelete'] || ''
  const extra = tasks ? `\n${nav.value.chrome['project.deleteTasks'] || ''} (${tasks})` : ''
  if (!window.confirm(`${base}${extra}`)) return
  await api(`/api/screens/${route.params.id}/${route.params.rowId}`, { locale: locale.value, method: 'DELETE' })
  router.push(`/screens/${route.params.id}`)
}

async function addLine() {
  fill(await api(`/api/screens/${route.params.id}/${route.params.rowId}/lines`, {
    locale: locale.value,
    method: 'POST',
    body: { ...line }
  }))
  line.product = ''
  line.description = ''
  line.qty = '1'
  line.unitPrice = ''
  line.vatRate = ''
}

async function removeLine(lineId) {
  fill(await api(`/api/screens/${route.params.id}/${route.params.rowId}/lines/${lineId}`, { locale: locale.value, method: 'DELETE' }))
}

function run(work) {
  error.value = ''
  work().catch((cause) => { error.value = cause.message })
}

function badgeClass(status) {
  const key = String(status || '').toLowerCase()
  return key ? `badge badge-${key}` : 'badge'
}

const project = computed(() => form.value?.screen?.layout === 'project')
const catalog = computed(() => form.value?.screen?.layout === 'service' || form.value?.screen?.layout === 'product')
const warehouse = computed(() => form.value?.screen?.layout === 'warehouse')
const party = computed(() => form.value?.screen?.layout === 'thirdparty')
const sharedOptions = computed(() => [
  { value: 'false', label: nav.value?.chrome?.['visibility.private'] || 'Private' },
  { value: 'true', label: nav.value?.chrome?.['visibility.shared'] || 'Shared' }
])
const sharedProxy = computed({
  get: () => (values.shared ? 'true' : 'false'),
  set: (value) => { values.shared = value === 'true' }
})
const viewing = computed(() => project.value && !!form.value?.row?.id && route.query.mode !== 'edit')
const partyViewing = computed(() => party.value && !!form.value?.row?.id && route.query.mode !== 'edit')
const creating = computed(() => project.value && !form.value?.row?.id)
const heading = computed(() => {
  if (party.value && !form.value?.row?.id) return nav.value?.chrome?.['thirdparty.heading'] || form.value.screen.title
  if (party.value && form.value?.row?.values?.name) return form.value.row.values.name
  if (!form.value?.row?.id && form.value?.screen?.layout === 'product') return nav.value?.chrome?.['menu.newProduct'] || 'Nouveau produit'
  if (!form.value?.row?.id && form.value?.screen?.layout === 'service') return nav.value?.chrome?.['menu.newService'] || 'Nouveau service'
  if (!form.value?.row?.id && form.value?.screen?.layout === 'warehouse') return nav.value?.chrome?.['menu.newWarehouse'] || 'Nouvel entrepôt'
  return creating.value ? (nav.value?.chrome?.['menu.newProject'] || form.value.screen.title) : form.value.screen.title
})

function meta(name) {
  return form.value.screen.fields.find((field) => field.name === name) || { label: name, options: [] }
}

function rich(name) {
  return name === 'description'
}

function shown(name) {
  return form.value.row.labels[name] || form.value.row.values[name] || ''
}

function weighted(amount, percent) {
  if (amount == null || amount === '' || percent == null || percent === '') return ''
  const value = Number(amount) * Number(percent) / 100
  if (!Number.isFinite(value)) return ''
  return value.toLocaleString(locale.value || 'fr', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function onBillTime() {
  if (values.usageBillTime) values.usageTask = true
}

function onTask() {
  if (!values.usageTask) values.usageBillTime = false
}

watch(() => [route.params.id, route.params.rowId, route.query.mode, route.query.tab, route.query.item, route.query.thirdParty, route.query.project], () => run(load), { immediate: true })
</script>

<template>
  <div v-if="form">
    <table class="table-fiche-title">
      <tbody>
        <tr class="toptitle">
          <td class="col-title">
            <div class="titre"><i :class="['bi', iconFor(form.screen.id)]"></i>{{ heading }}</div>
          </td>
          <td class="col-right">
            <span v-if="form.row.status && form.row.id && !viewing && !partyViewing" :class="badgeClass(form.row.status)">{{ form.row.labels.status || form.row.status }}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="fiche-layout" :class="{ 'with-files': !!form.tray }">
    <aside v-if="form.tray" class="fiche-files">
      <header>{{ form.tray.title }} <span v-if="form.tray.files.length">{{ form.tray.files.length }}</span></header>
      <ul>
        <li v-for="file in form.tray.files" :key="file.id" :class="{ selected: picked === file.id }" @click="picked = file.id">
          <i class="bi" :class="file.name?.toLowerCase().endsWith('.pdf') ? 'bi-file-earmark-pdf' : 'bi-file-earmark'"></i>
          <span>{{ file.name }}</span>
        </li>
      </ul>
      <p v-if="pickedFile" class="fiche-preview-name">{{ pickedFile.name }}</p>
      <iframe v-if="pickedFile && pickedFile.name?.toLowerCase().endsWith('.pdf')" class="fiche-preview" :src="`/api/plugins/filemanager/raw/${pickedFile.id}`" :title="pickedFile.name"></iframe>
      <p v-else class="opacitymedium">{{ form.tray.labels.preview }}</p>
      <p v-if="trayLink">{{ form.tray.labels.link }} : <a :href="trayLink">{{ trayLink }}</a></p>
      <FileUpload :locale="locale" :nav="nav" :folder="form.tray.folder" :owner-type="form.tray.ownerType" :owner-id="form.tray.ownerId" :label="form.tray.labels.upload" @done="load" @fail="(message) => { error.value = message }" />
      <button v-if="pickedFile && !pickedFile.virtual" type="button" @click="run(() => trayAct('share', { id: pickedFile.id }))">{{ form.tray.labels.share }}</button>
      <button v-if="pickedFile && !pickedFile.virtual" type="button" @click="run(() => trayAct('sign', { id: pickedFile.id, provider: 'internal' }))">{{ form.tray.labels.sign }}</button>
    </aside>
    <div>
    <div class="tabs">
      <template v-if="form.tabs?.length && form.row.id">
        <router-link v-for="item in form.tabs" :key="item.code" custom :to="tabTo(item)" v-slot="{ href, navigate }">
          <a :href="href" :class="['tab', item.code === form.activeTab ? 'tabactive' : '']" :aria-current="item.code === form.activeTab ? 'page' : undefined" @click="navigate">{{ item.label }}<span v-if="item.count" class="tab-count">{{ item.count }}</span></a>
        </router-link>
      </template>
      <router-link v-else class="tab tabactive" :to="route.fullPath">{{ heading }}</router-link>
      <router-link class="tab" :to="`/screens/${form.screen.id}`">{{ nav.chrome['action.backToList'] || nav.chrome['action.back'] }}</router-link>
    </div>
    <div v-if="form.panel" class="tabBar">
      <div v-if="project" class="project-banner">
        <div>
          <div class="refid">{{ form.row.values.ref }}</div>
          <div class="refidno">{{ form.row.values.title }}</div>
          <div v-if="form.row.values.thirdParty" class="refidno">
            <router-link :to="`/screens/thirdparties/${form.row.values.thirdParty}`">{{ form.row.labels.thirdParty }}</router-link>
          </div>
        </div>
        <div class="banner-right">
          <span :class="badgeClass(form.row.status)">{{ form.row.labels.status || form.row.status }}</span>
          <div class="refidno">
            <router-link :to="`/screens/${form.screen.id}`">{{ nav.chrome['action.backToList'] || nav.chrome['action.back'] }}</router-link>
          </div>
        </div>
      </div>
      <table v-if="!form.panel.skipTable" class="tagtable liste">
        <thead>
          <tr class="liste_titre">
            <th v-for="column in form.panel.columns" :key="column">{{ column }}</th>
            <th v-if="form.panel.rows.some((line) => line.editable || line.deletable)"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!form.panel.rows.length">
            <td :colspan="form.panel.columns.length || 1" class="opacitymedium">{{ form.panel.empty }}</td>
          </tr>
          <tr v-for="(line, index) in form.panel.rows" :key="index" class="oddeven">
            <td v-for="(cell, cellIndex) in line.cells" :key="cellIndex">
              <a v-if="cellIndex === 0 && form.panel.manage === 'file' && line.itemId" :href="`/api/screens/${form.screen.id}/${form.row.id}/files/${line.itemId}`">{{ cell }}</a>
              <router-link v-else-if="cellIndex === 0 && line.screen && line.id" :to="`/screens/${line.screen}/${line.id}`">{{ cell }}</router-link>
              <template v-else>{{ cell }}</template>
            </td>
            <td v-if="line.editable || line.deletable" class="row-actions">
              <button v-if="line.editable" class="butAction" type="button" @click="router.push({ path: route.path, query: { tab: form.activeTab, item: line.itemId } })">{{ form.panel.editor?.editLabel }}</button>
              <button v-if="line.deletable" class="butActionDelete" type="button" @click="run(() => removeTab(line))">{{ line.remove === 'unlink' ? form.panel.editor?.unlinkLabel : form.panel.editor?.deleteLabel }}</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="form.panel.editor" class="tab-editor">
        <div v-if="form.panel.editor.permissions" class="perm-matrix-wrap">
          <p v-if="form.panel.editor.permissions.admin" class="opacitymedium perm-hint">{{ form.panel.editor.permissions.hint }}</p>
          <table class="noborder centpercent perm-matrix">
            <thead>
              <tr class="liste_titre">
                <td>{{ form.panel.editor.permissions.moduleLabel }}</td>
                <td class="center perm-actions">
                  <button type="button" @click="run(() => setRight('grant-all'))">{{ form.panel.editor.permissions.allLabel }}</button>
                  /
                  <button type="button" @click="run(() => setRight('revoke-all'))">{{ form.panel.editor.permissions.noneLabel }}</button>
                </td>
                <td></td>
                <td class="right">
                  <button type="button" class="butAction" @click="setModules(true)">{{ form.panel.editor.permissions.expandLabel }}</button>
                  <button type="button" class="butAction" @click="setModules(false)">{{ form.panel.editor.permissions.collapseLabel }}</button>
                </td>
              </tr>
            </thead>
            <tbody>
              <template v-for="mod in form.panel.editor.permissions.modules" :key="mod.code">
                <tr class="perm-module" :class="{ open: moduleOpen(mod.code) }">
                  <td>
                    <button type="button" class="perm-folder" @click="toggleModule(mod.code)">
                      <span class="vmenu-caret"></span>{{ mod.label }}
                    </button>
                  </td>
                  <td class="center perm-actions">
                    <button type="button" @click="run(() => setRight('grant-module', { module: mod.code }))">{{ form.panel.editor.permissions.allLabel }}</button>
                    /
                    <button type="button" @click="run(() => setRight('revoke-module', { module: mod.code }))">{{ form.panel.editor.permissions.noneLabel }}</button>
                  </td>
                  <td></td>
                  <td></td>
                </tr>
                <tr v-for="right in mod.rights" v-show="moduleOpen(mod.code)" :key="right.code" class="oddeven">
                  <td></td>
                  <td class="center">
                    <button v-if="right.state === 'on'" type="button" class="perm-switch on" :aria-pressed="true" :aria-label="right.label" @click="run(() => setRight('revoke', { code: right.code }))"></button>
                    <span v-else-if="right.state === 'inherited'" class="perm-switch on inherited" :title="form.panel.editor.permissions.inheritedLabel"></span>
                    <button v-else type="button" class="perm-switch" :aria-pressed="false" :aria-label="right.label" @click="run(() => setRight('grant', { code: right.code }))"></button>
                  </td>
                  <td class="opacitymedium">
                    <template v-if="right.state === 'inherited'">{{ form.panel.editor.permissions.inheritedLabel }}<template v-if="form.panel.editor.permissions.groupName"> ({{ form.panel.editor.permissions.groupName }})</template></template>
                  </td>
                  <td>{{ right.label }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
        <div v-if="form.panel.editor.launches?.length" class="tabsAction">
          <router-link v-for="launch in form.panel.editor.launches" :key="launch.screen" class="butAction" :to="{ path: `/screens/${launch.screen}/new`, query: launch.query }">{{ launch.label }}</router-link>
        </div>
        <form v-if="form.panel.editor.upload" class="tabBar" @submit.prevent="(event) => run(() => uploadTab(event))">
          <input name="upload" class="flat" type="file" required />
          <div class="tabsAction"><button class="butAction" type="submit">{{ form.panel.editor.submitLabel }}</button></div>
        </form>
        <form v-else-if="form.panel.editor.fields?.length" class="tabBar" @submit.prevent="run(() => commitTab(form.panel.editor.itemId ? 'update' : 'create', form.panel.editor.itemId))">
          <table class="border tableforfield">
            <tbody>
              <tr v-for="field in form.panel.editor.fields" :key="field.name">
                <td class="titlefield">{{ field.label }}</td>
                <td>
                  <RichEditor v-if="field.type === 'text' && rich(field.name)" v-model="draft[field.name]" compact />
                  <textarea v-else-if="field.type === 'text'" v-model="draft[field.name]" class="flat" :rows="!field.max || field.max > 255 ? 4 : 2" :required="field.required" />
                  <span v-else-if="field.type === 'boolean'" class="field-bool">
                    <label><input type="radio" :name="'tab-' + field.name" :value="true" v-model="draft[field.name]" /> {{ nav.chrome['action.yes'] }}</label>
                    <label><input type="radio" :name="'tab-' + field.name" :value="false" v-model="draft[field.name]" /> {{ nav.chrome['action.no'] }}</label>
                  </span>
                  <SearchableSelect v-else-if="field.type === 'ref' || field.type === 'enum'" v-model="draft[field.name]" :options="field.options || []" :multiple="field.multiple" :required="field.required && !field.multiple" :searchThreshold="field.type === 'ref' ? 1 : 12" :id="'tab-' + field.name" :placeholder="''" />
                  <input v-else-if="field.type === 'date'" v-model="draft[field.name]" class="flat" type="date" :required="field.required" />
                  <input v-else-if="field.type === 'decimal'" v-model="draft[field.name]" class="flat" type="number" step="0.01" :required="field.required" />
                  <input v-else-if="field.type === 'integer'" v-model="draft[field.name]" class="flat" type="number" step="1" :required="field.required" />
                  <input v-else v-model="draft[field.name]" class="flat" :type="field.type === 'email' || field.type === 'tel' || field.type === 'url' ? field.type : 'text'" :required="field.required" />
                </td>
              </tr>
            </tbody>
          </table>
          <div class="tabsAction">
            <button class="butAction" type="submit">{{ form.panel.editor.submitLabel }}</button>
            <router-link v-if="form.panel.editor.itemId" class="butActionDelete" :to="{ path: route.path, query: { tab: form.activeTab } }">{{ nav.chrome['action.cancel'] }}</router-link>
          </div>
        </form>
      </div>
    </div>
    <div v-else-if="viewing" class="tabBar">
      <div class="project-banner">
        <div>
          <div class="refid">{{ form.row.values.ref }}</div>
          <div class="refidno">{{ form.row.values.title }}</div>
          <div v-if="form.row.values.thirdParty" class="refidno">
            <router-link :to="`/screens/thirdparties/${form.row.values.thirdParty}`">{{ form.row.labels.thirdParty }}</router-link>
          </div>
        </div>
        <div class="banner-right">
          <span :class="badgeClass(form.row.status)">{{ form.row.labels.status || form.row.status }}</span>
          <div class="refidno">
            <router-link :to="`/screens/${form.screen.id}`">{{ nav.chrome['action.backToList'] || nav.chrome['action.back'] }}</router-link>
          </div>
        </div>
      </div>
      <div class="fichecenter">
        <div class="fichehalfleft">
          <table class="border tableforfield">
            <tbody>
              <tr>
                <td class="titlefield">{{ nav.chrome['field.utilisation'] }}</td>
                <td class="usage-list">
                  <span>{{ nav.chrome['field.usageOpportunity'] }} : {{ form.row.values.usageOpportunity ? nav.chrome['action.yes'] : nav.chrome['action.no'] }}</span>
                  <span>{{ nav.chrome['field.usageTask'] }} : {{ form.row.values.usageTask ? nav.chrome['action.yes'] : nav.chrome['action.no'] }}</span>
                  <span>{{ nav.chrome['field.usageBillTime'] }} : {{ form.row.values.usageBillTime ? nav.chrome['action.yes'] : nav.chrome['action.no'] }}</span>
                </td>
              </tr>
              <template v-if="form.row.values.usageOpportunity">
                <tr>
                  <td class="titlefield">{{ nav.chrome['field.oppStatus'] }}</td>
                  <td>{{ shown('oppStatus') }}<span v-if="shown('oppPercent')"> ({{ shown('oppPercent') }} %)</span></td>
                </tr>
                <tr>
                  <td class="titlefield">{{ nav.chrome['field.oppAmount'] }}</td>
                  <td>{{ shown('oppAmount') }}<span v-if="weighted(form.row.values.oppAmount, form.row.values.oppPercent)"> · {{ nav.chrome['field.oppWeighted'] }} {{ weighted(form.row.values.oppAmount, form.row.values.oppPercent) }}</span></td>
                </tr>
              </template>
              <tr>
                <td class="titlefield">{{ nav.chrome['field.budget'] }}</td>
                <td>{{ shown('budget') }}</td>
              </tr>
              <tr>
                <td class="titlefield">{{ nav.chrome['field.projectDateStart'] }}</td>
                <td>{{ shown('dateStart') || '?' }} — {{ shown('dateEnd') || '?' }}</td>
              </tr>
              <tr>
                <td class="titlefield">{{ nav.chrome['field.visibility'] }}</td>
                <td>
                  <i :class="['bi', form.row.values.shared ? 'bi-people' : 'bi-lock']"></i>
                  {{ form.row.values.shared ? nav.chrome['visibility.shared'] : nav.chrome['visibility.private'] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="fichehalfright">
          <table class="border tableforfield">
            <tbody>
              <tr>
                <td class="titlefield">{{ meta('description').label }}</td>
                <td class="project-note" v-html="form.row.values.description"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="tabsAction">
        <router-link class="butAction" :to="{ path: `/screens/${form.screen.id}/${form.row.id}`, query: { mode: 'edit' } }">{{ nav.chrome['action.modify'] }}</router-link>
        <button v-if="(form.row.transitions || []).includes('open') && form.row.status === 'draft'" class="butAction" type="button" @click="run(() => transit('open'))">{{ nav.chrome['action.validate'] }}</button>
        <button v-if="(form.row.transitions || []).includes('closed')" class="butAction" type="button" @click="run(() => transit('closed'))">{{ nav.chrome['action.close'] }}</button>
        <button v-if="(form.row.transitions || []).includes('draft')" class="butAction" type="button" @click="run(() => transit('draft'))">{{ nav.chrome['action.setToDraft'] }}</button>
        <button v-if="(form.row.transitions || []).includes('open') && form.row.status === 'closed'" class="butAction" type="button" @click="run(() => transit('open'))">{{ nav.chrome['action.reopen'] }}</button>
        <a v-if="form.screen.printable" class="butAction" :href="`/api/screens/${form.screen.id}/${form.row.id}/pdf?lang=${locale}`">{{ nav.chrome['action.pdf'] || 'PDF' }}</a>
        <button class="butActionDelete" type="button" @click="run(remove)">{{ nav.chrome['action.delete'] }}</button>
      </div>
    </div>
    <form v-else-if="project" class="tabBar" @submit.prevent="run(save)">
      <table class="border tableforfield">
        <tbody>
          <tr>
            <td class="titlefield">{{ meta('ref').label }}</td>
            <td>
              <textarea v-if="meta('ref').type === 'text'" id="ref" v-model="values.ref" class="flat" rows="2" required />
              <input v-else id="ref" v-model="values.ref" class="flat" required />
            </td>
          </tr>
          <tr>
            <td class="titlefield">{{ meta('title').label }}</td>
            <td>
              <textarea v-if="meta('title').type === 'text'" id="title" v-model="values.title" class="flat" rows="2" required />
              <input v-else id="title" v-model="values.title" class="flat" required />
            </td>
          </tr>
          <tr>
            <td class="titlefield">{{ nav.chrome['field.utilisation'] }}</td>
            <td class="usage-list">
              <span class="field-bool">
                <span>{{ nav.chrome['field.usageOpportunity'] }}</span>
                <label><input v-model="values.usageOpportunity" type="radio" name="usageOpportunity" :value="true" /> {{ nav.chrome['action.yes'] }}</label>
                <label><input v-model="values.usageOpportunity" type="radio" name="usageOpportunity" :value="false" /> {{ nav.chrome['action.no'] }}</label>
              </span>
              <span class="field-bool">
                <span>{{ nav.chrome['field.usageTask'] }}</span>
                <label><input v-model="values.usageTask" type="radio" name="usageTask" :value="true" @change="onTask" /> {{ nav.chrome['action.yes'] }}</label>
                <label><input v-model="values.usageTask" type="radio" name="usageTask" :value="false" @change="onTask" /> {{ nav.chrome['action.no'] }}</label>
              </span>
              <span class="field-bool">
                <span>{{ nav.chrome['field.usageBillTime'] }}</span>
                <label><input v-model="values.usageBillTime" type="radio" name="usageBillTime" :value="true" @change="onBillTime" /> {{ nav.chrome['action.yes'] }}</label>
                <label><input v-model="values.usageBillTime" type="radio" name="usageBillTime" :value="false" @change="onBillTime" /> {{ nav.chrome['action.no'] }}</label>
              </span>
            </td>
          </tr>
          <tr>
            <td class="titlefield">{{ meta('thirdParty').label }}</td>
            <td>
              <SearchableSelect id="thirdParty" v-model="values.thirdParty" :options="meta('thirdParty').options || []" :searchThreshold="1" :placeholder="''" />
            </td>
          </tr>
          <tr v-show="values.usageOpportunity">
            <td class="titlefield">{{ nav.chrome['field.oppStatus'] }}</td>
            <td class="pair">
              <SearchableSelect id="oppStatus" v-model="values.oppStatus" :options="meta('oppStatus').options || []" :required="values.usageOpportunity" :placeholder="''" />
              <input id="oppPercent" v-model="values.oppPercent" class="flat" type="number" step="0.01" />
              <span>%</span>
            </td>
          </tr>
          <tr v-show="values.usageOpportunity">
            <td class="titlefield">{{ nav.chrome['field.oppAmount'] }}</td>
            <td><input id="oppAmount" v-model="values.oppAmount" class="flat" type="number" step="0.01" /></td>
          </tr>
          <tr>
            <td class="titlefield">{{ nav.chrome['field.budget'] }}</td>
            <td><input id="budget" v-model="values.budget" class="flat" type="number" step="0.01" /></td>
          </tr>
          <tr>
            <td class="titlefield">{{ nav.chrome['field.projectDateStart'] }}</td>
            <td class="pair">
              <input id="dateStart" v-model="values.dateStart" class="flat" type="date" />
              <span>{{ nav.chrome['project.to'] }}</span>
              <input id="dateEnd" v-model="values.dateEnd" class="flat" type="date" />
            </td>
          </tr>
          <tr>
            <td class="titlefield">{{ meta('description').label }}</td>
            <td><RichEditor v-model="values.description" compact /></td>
          </tr>
          <tr>
            <td class="titlefield">{{ nav.chrome['field.visibility'] }}</td>
            <td>
              <SearchableSelect id="shared" v-model="sharedProxy" :options="sharedOptions" :placeholder="''" />
            </td>
          </tr>
        </tbody>
      </table>
      <div class="tabsAction">
        <button class="butAction" type="submit">{{ creating ? nav.chrome['action.createDraft'] : nav.chrome['action.save'] }}</button>
        <router-link v-if="creating" class="butActionDelete" :to="`/screens/${form.screen.id}`">{{ nav.chrome['action.cancel'] }}</router-link>
        <router-link v-else class="butActionDelete" :to="`/screens/${form.screen.id}/${form.row.id}`">{{ nav.chrome['action.cancel'] }}</router-link>
      </div>
    </form>
    <CatalogForm v-else-if="catalog" :form="form" :values="values" @save="run(save)" @remove="run(remove)" />
    <WarehouseForm v-else-if="warehouse" :form="form" :values="values" @save="run(save)" @remove="run(remove)" />
    <div v-else-if="partyViewing" class="tabBar">
      <ThirdPartyCard :form="form" @remove="run(remove)" />
    </div>
    <ThirdPartyForm v-else-if="party" :form="form" :values="values" @save="run(save)" @remove="run(remove)" />
    <div v-else class="tabBar">
      <form @submit.prevent="run(save)">
        <table class="border tableforfield">
          <tbody>
            <tr v-for="field in form.screen.fields" :key="field.name">
              <td class="titlefield">{{ field.label }}</td>
              <td>
                <RichEditor v-if="field.type === 'text' && rich(field.name)" :id="field.name" v-model="values[field.name]" compact />
                <textarea v-else-if="field.type === 'text'" :id="field.name" v-model="values[field.name]" class="flat" :readonly="field.readOnly" :rows="!field.max || field.max > 255 ? 4 : 2" />
                <span v-else-if="field.type === 'boolean'" class="field-bool">
                  <label><input type="radio" :name="field.name" :value="true" v-model="values[field.name]" :disabled="field.readOnly" /> {{ nav.chrome['action.yes'] }}</label>
                  <label><input type="radio" :name="field.name" :value="false" v-model="values[field.name]" :disabled="field.readOnly" /> {{ nav.chrome['action.no'] }}</label>
                </span>
                <SearchableSelect v-else-if="field.type === 'enum' || field.type === 'ref'" :id="field.name" v-model="values[field.name]" :options="field.options || []" :multiple="field.multiple" :disabled="field.readOnly" :searchThreshold="field.type === 'ref' ? 1 : 12" :placeholder="''" />
                <input v-else-if="field.type === 'date'" :id="field.name" v-model="values[field.name]" class="flat" type="date" :readonly="field.readOnly" />
                <input v-else-if="field.type === 'decimal'" :id="field.name" v-model="values[field.name]" class="flat" type="number" step="0.01" :readonly="field.readOnly" />
                <input v-else-if="field.type === 'integer'" :id="field.name" v-model="values[field.name]" class="flat" type="number" step="1" :readonly="field.readOnly" />
                <input v-else :id="field.name" v-model="values[field.name]" class="flat" :type="field.type === 'email' || field.type === 'tel' || field.type === 'url' ? field.type : 'text'" :readonly="field.readOnly" :required="field.required" :maxlength="field.max || undefined" />
              </td>
            </tr>
            <tr v-if="form.screen.id === 'users'">
              <td class="titlefield">{{ nav.chrome['field.password'] || 'Password' }}</td>
              <td><input v-model="password" class="flat" type="password" autocomplete="new-password" :required="!form.row.id" /></td>
            </tr>
          </tbody>
        </table>
        <p v-if="form.screen.layout === 'document'" class="fiche-totals">
          {{ nav.chrome['field.totalHt'] || 'HT' }} {{ form.row.labels.totalHt || form.row.values.totalHt || '' }}
          · {{ nav.chrome['field.totalTtc'] || 'TTC' }} {{ form.row.labels.totalTtc || form.row.values.totalTtc || '' }}
        </p>
        <div class="tabsAction">
          <button class="butAction" type="submit">{{ nav.chrome['action.save'] }}</button>
          <a v-if="form.screen.printable && form.row.id" class="butAction" :href="`/api/screens/${form.screen.id}/${form.row.id}/pdf?lang=${locale}`">{{ nav.chrome['action.pdf'] || 'PDF' }}</a>
          <button v-for="target in form.row.transitions || []" :key="target" class="butAction" type="button" @click="run(() => transit(target))">
            {{ form.row.transitionLabels[target] || target }}
          </button>
          <button v-if="form.row.id" class="butActionDelete" type="button" @click="run(remove)">{{ nav.chrome['action.delete'] }}</button>
        </div>
      </form>
    </div>
    <div v-if="!form.panel && form.screen.withLines && form.row.id">
      <table class="table-fiche-title">
        <tbody>
          <tr><td class="col-title"><div class="titre">{{ nav.chrome['action.lines'] }}</div></td></tr>
        </tbody>
      </table>
      <table class="tagtable liste">
        <thead>
          <tr class="liste_titre">
            <th>{{ nav.chrome['field.product'] || 'Product' }}</th>
            <th>{{ nav.chrome['field.description'] || 'Description' }}</th>
            <th>{{ nav.chrome['field.qty'] || 'Qty' }}</th>
            <th>{{ nav.chrome['field.unitPrice'] || 'Price' }}</th>
            <th>{{ nav.chrome['field.vatRate'] || 'VAT' }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in form.lines" :key="item.id" class="oddeven">
            <td>{{ item.productLabel }}</td>
            <td>{{ item.description }}</td>
            <td>{{ item.qty }}</td>
            <td>{{ item.unitPrice }}</td>
            <td>{{ item.vatRate }}</td>
            <td><button class="butActionDelete" type="button" @click="run(() => removeLine(item.id))">{{ nav.chrome['action.delete'] }}</button></td>
          </tr>
        </tbody>
      </table>
      <form class="inline-form" @submit.prevent="run(addLine)">
        <SearchableSelect v-model="line.product" :options="form.screen.products || []" :searchThreshold="1" :placeholder="''" />
        <textarea v-model="line.description" class="flat" rows="2"></textarea>
        <input v-model="line.qty" class="flat" type="number" step="0.01" />
        <input v-model="line.unitPrice" class="flat" type="number" step="0.01" />
        <input v-model="line.vatRate" class="flat" type="number" step="0.01" />
        <button class="butAction" type="submit">{{ nav.chrome['action.addLine'] }}</button>
      </form>
    </div>
    <div v-if="form.tasks?.length && !form.tabs?.some((item) => item.code === 'tasks')">
      <table class="table-fiche-title">
        <tbody>
          <tr><td class="col-title"><div class="titre">{{ nav.chrome['menu.tasks'] || 'Tasks' }}</div></td></tr>
        </tbody>
      </table>
      <table class="tagtable liste">
        <tbody>
          <tr v-for="task in form.tasks" :key="task.id" class="oddeven">
            <td><router-link :to="`/screens/tasks/${task.id}`">{{ task.title }}</router-link></td>
            <td>{{ task.statusLabel }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    </div>
    </div>
  </div>
</template>
