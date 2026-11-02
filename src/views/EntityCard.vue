<script setup>
import { computed, inject, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'

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
  for (const field of payload.screen?.fields || []) {
    if (field.type === 'boolean') {
      values[field.name] = values[field.name] === true || values[field.name] === 'true'
    } else if (values[field.name] == null) {
      values[field.name] = ''
    } else if (field.type === 'ref' || field.type === 'enum') {
      values[field.name] = String(values[field.name])
    }
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

async function trayUpload(event) {
  const data = new FormData(event.target)
  data.set('folder', form.value.tray.folder || '')
  data.set('ownerType', form.value.tray.ownerType || '')
  data.set('ownerId', form.value.tray.ownerId || '')
  const response = await fetch(`/api/plugins/filemanager/upload?lang=${encodeURIComponent(locale.value)}`, { method: 'POST', credentials: 'include', body: data })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || response.statusText)
  event.target.reset()
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
  if (form.value.screen.layout === 'project') {
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
const viewing = computed(() => project.value && !!form.value?.row?.id && route.query.mode !== 'edit')
const creating = computed(() => project.value && !form.value?.row?.id)
const heading = computed(() => creating.value ? (nav.value?.chrome?.['menu.newProject'] || form.value.screen.title) : form.value.screen.title)

function meta(name) {
  return form.value.screen.fields.find((field) => field.name === name) || { label: name, options: [] }
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
            <span v-if="form.row.status && form.row.id && !viewing" :class="badgeClass(form.row.status)">{{ form.row.labels.status || form.row.status }}</span>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="tabs">
      <template v-if="form.tabs?.length && form.row.id">
        <router-link v-for="item in form.tabs" :key="item.code" custom :to="tabTo(item)" v-slot="{ href, navigate }">
          <a :href="href" :class="['tab', item.code === form.activeTab ? 'tabactive' : '']" :aria-current="item.code === form.activeTab ? 'page' : undefined" @click="navigate">{{ item.label }}<span v-if="item.count" class="tab-count">{{ item.count }}</span></a>
        </router-link>
      </template>
      <router-link v-else class="tab tabactive" :to="route.fullPath">{{ heading }}</router-link>
      <router-link class="tab" :to="`/screens/${form.screen.id}`">{{ nav.chrome['action.backToList'] || nav.chrome['action.back'] }}</router-link>
    </div>
    <details v-if="form.tray" class="doc-tray" open>
      <summary>{{ form.tray.title }}</summary>
      <p class="opacitymedium">{{ form.tray.hint }}</p>
      <ul>
        <li v-for="file in form.tray.files" :key="file.id">
          <a :href="`/api/plugins/filemanager/raw/${file.id}`">{{ file.name }}</a>
          <span v-if="file.expires" class="opacitymedium">{{ file.expires }}</span>
          <span v-if="file.signed" class="opacitymedium">{{ form.tray.labels.sign }}</span>
          <button v-if="!file.virtual" type="button" @click="run(() => trayAct('share', { id: file.id }))">{{ form.tray.labels.share }}</button>
          <button v-if="!file.virtual" type="button" @click="run(() => trayAct('sign', { id: file.id, provider: 'internal' }))">{{ form.tray.labels.sign }}</button>
        </li>
      </ul>
      <p v-if="trayLink">{{ form.tray.labels.link }} : <a :href="trayLink">{{ trayLink }}</a></p>
      <form class="library-tools" @submit.prevent="run(() => trayUpload($event))">
        <input name="upload" class="flat" type="file" required />
        <button class="butAction" type="submit">{{ form.tray.labels.upload }}</button>
      </form>
    </details>
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
                  <textarea v-if="field.type === 'text'" v-model="draft[field.name]" class="flat" rows="4" :required="field.required" />
                  <select v-else-if="field.type === 'ref'" v-model="draft[field.name]" class="flat" :required="field.required">
                    <option value=""></option>
                    <option v-for="option in field.options || []" :key="option.value" :value="String(option.value)">{{ option.label }}</option>
                  </select>
                  <input v-else-if="field.type === 'date'" v-model="draft[field.name]" class="flat" type="date" :required="field.required" />
                  <input v-else v-model="draft[field.name]" class="flat" :required="field.required" />
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
                  <label><input type="checkbox" disabled :checked="form.row.values.usageOpportunity" /> {{ nav.chrome['field.usageOpportunity'] }}</label>
                  <label><input type="checkbox" disabled :checked="form.row.values.usageTask" /> {{ nav.chrome['field.usageTask'] }}</label>
                  <label><input type="checkbox" disabled :checked="form.row.values.usageBillTime" /> {{ nav.chrome['field.usageBillTime'] }}</label>
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
                <td class="project-note">{{ form.row.values.description }}</td>
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
            <td><input id="ref" v-model="values.ref" class="flat" required /></td>
          </tr>
          <tr>
            <td class="titlefield">{{ meta('title').label }}</td>
            <td><input id="title" v-model="values.title" class="flat" required /></td>
          </tr>
          <tr>
            <td class="titlefield">{{ nav.chrome['field.utilisation'] }}</td>
            <td class="usage-list">
              <label><input id="usageOpportunity" v-model="values.usageOpportunity" type="checkbox" /> {{ nav.chrome['field.usageOpportunity'] }}</label>
              <label><input id="usageTask" v-model="values.usageTask" type="checkbox" @change="onTask" /> {{ nav.chrome['field.usageTask'] }}</label>
              <label><input id="usageBillTime" v-model="values.usageBillTime" type="checkbox" @change="onBillTime" /> {{ nav.chrome['field.usageBillTime'] }}</label>
            </td>
          </tr>
          <tr>
            <td class="titlefield">{{ meta('thirdParty').label }}</td>
            <td>
              <select id="thirdParty" v-model="values.thirdParty" class="flat">
                <option value=""></option>
                <option v-for="option in meta('thirdParty').options" :key="option.value" :value="String(option.value)">{{ option.label }}</option>
              </select>
            </td>
          </tr>
          <tr v-show="values.usageOpportunity">
            <td class="titlefield">{{ nav.chrome['field.oppStatus'] }}</td>
            <td class="pair">
              <select id="oppStatus" v-model="values.oppStatus" class="flat" :required="values.usageOpportunity">
                <option value=""></option>
                <option v-for="option in meta('oppStatus').options" :key="option.value" :value="String(option.value)">{{ option.label }}</option>
              </select>
              <input id="oppPercent" v-model="values.oppPercent" class="flat" inputmode="decimal" />
              <span>%</span>
            </td>
          </tr>
          <tr v-show="values.usageOpportunity">
            <td class="titlefield">{{ nav.chrome['field.oppAmount'] }}</td>
            <td><input id="oppAmount" v-model="values.oppAmount" class="flat" inputmode="decimal" /></td>
          </tr>
          <tr>
            <td class="titlefield">{{ nav.chrome['field.budget'] }}</td>
            <td><input id="budget" v-model="values.budget" class="flat" inputmode="decimal" /></td>
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
            <td><textarea id="description" v-model="values.description" class="flat" rows="4"></textarea></td>
          </tr>
          <tr>
            <td class="titlefield">{{ nav.chrome['field.visibility'] }}</td>
            <td>
              <select id="shared" class="flat" :value="values.shared ? 'true' : 'false'" @change="values.shared = $event.target.value === 'true'">
                <option value="false">{{ nav.chrome['visibility.private'] }}</option>
                <option value="true">{{ nav.chrome['visibility.shared'] }}</option>
              </select>
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
    <div v-else class="tabBar">
      <form @submit.prevent="run(save)">
        <table class="border tableforfield">
          <tbody>
            <tr v-for="field in form.screen.fields" :key="field.name">
              <td class="titlefield">{{ field.label }}</td>
              <td>
                <textarea v-if="field.type === 'text'" :id="field.name" v-model="values[field.name]" class="flat" :readonly="field.readOnly" rows="3" />
                <input v-else-if="field.type === 'boolean'" :id="field.name" v-model="values[field.name]" class="flat" type="checkbox" :disabled="field.readOnly" />
                <select v-else-if="field.type === 'enum' || field.type === 'ref'" :id="field.name" v-model="values[field.name]" class="flat" :disabled="field.readOnly">
                  <option value=""></option>
                  <option v-for="option in field.options" :key="option.value" :value="String(option.value)">{{ option.label }}</option>
                </select>
                <input v-else-if="field.type === 'date'" :id="field.name" v-model="values[field.name]" class="flat" type="date" :readonly="field.readOnly" />
                <input v-else :id="field.name" v-model="values[field.name]" class="flat" :readonly="field.readOnly" :required="field.required" />
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
        <select v-model="line.product" class="flat">
          <option value=""></option>
          <option v-for="product in form.screen.products" :key="product.value" :value="String(product.value)">{{ product.label }}</option>
        </select>
        <input v-model="line.description" class="flat" />
        <input v-model="line.qty" class="flat" />
        <input v-model="line.unitPrice" class="flat" />
        <input v-model="line.vatRate" class="flat" />
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
</template>
