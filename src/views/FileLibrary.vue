<script setup>
import { computed, inject, ref } from 'vue'
import { api } from '../api'

const props = defineProps({ page: { type: Object, required: true } })
const emit = defineEmits(['update'])
const locale = inject('locale')
const error = inject('error')
const menu = ref(null)
const dialog = ref(null)
const dialogNode = ref(null)
const tool = ref('text')
const pdfPage = ref(1)

const labels = computed(() => props.page.labels || {})
const settings = computed(() => props.page.settings || {})

async function call(verb, extra = {}) {
  menu.value = null
  const current = props.page
  const result = await api(`/api/plugins/filemanager/${verb}`, {
    locale: locale.value,
    method: 'POST',
    body: {
      source: current.source,
      folder: current.folder || '',
      q: current.q || '',
      section: current.section,
      tab: current.tab,
      panel: current.panel,
      view: current.view,
      ...extra
    }
  })
  emit('update', { ...result, title: current.title, icon: current.icon, id: current.id })
}

async function upload(event, verb = 'upload') {
  const data = new FormData(event.target)
  data.set('source', props.page.source || '')
  data.set('folder', props.page.folder || '')
  data.set('section', props.page.section || '')
  data.set('tab', props.page.tab || '')
  if (verb === 'version' && props.page.preview?.id) data.set('id', props.page.preview.id)
  const response = await fetch(`/api/plugins/filemanager/${verb}?lang=${encodeURIComponent(locale.value)}`, { method: 'POST', credentials: 'include', body: data })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || response.statusText)
  emit('update', { ...result, title: props.page.title, icon: props.page.icon, id: props.page.id })
  event.target.reset()
}

function go(extra) {
  return call('list', extra).catch((cause) => { error.value = cause.message })
}

async function backup() {
  const result = await api('/api/plugins/filemanager/backup', { locale: locale.value, method: 'POST', body: {} })
  const blob = new Blob([result.json || ''], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'filemanager-backup.json'
  link.click()
  URL.revokeObjectURL(url)
}

function openMenu(event, node) {
  menu.value = { x: event.clientX, y: event.clientY, node }
}

function show(name, node) {
  dialog.value = name
  dialogNode.value = node
  menu.value = null
}

function submitDialog(event, verb, extra = {}) {
  const data = Object.fromEntries(new FormData(event.target).entries())
  call(verb, { id: dialogNode.value?.id, ...data, ...extra })
    .then(() => { dialog.value = null })
    .catch((cause) => { error.value = cause.message })
}

const sections = computed(() => [
  { id: 'upload', icon: 'bi-file-earmark-plus', label: labels.value.newDoc },
  { id: 'explorer', icon: 'bi-folder2-open', label: labels.value.explorer, children: [
    { id: 'explorer', source: 'ged', label: labels.value.ged },
    { id: 'explorer', source: 'erp', label: labels.value.erp }
  ] },
  { id: 'validity', icon: 'bi-calendar-event', label: labels.value.validity, children: [
    { id: 'validity', label: labels.value.validityList },
    { id: 'validityNew', label: labels.value.validityNew },
    { id: 'docTypes', label: labels.value.docTypes }
  ] },
  { id: 'requestsIn', icon: 'bi-key', label: labels.value.requests, children: [
    { id: 'requestsIn', label: labels.value.requestsIn },
    { id: 'requestsOut', label: labels.value.requestsOut }
  ] },
  { id: 'shares', icon: 'bi-share', label: labels.value.myShares },
  { id: 'signNew', icon: 'bi-vector-pen', label: labels.value.signatures, children: [
    { id: 'signNew', label: labels.value.signNew },
    { id: 'signOut', label: labels.value.signOut },
    { id: 'signIn', label: labels.value.signIn },
    { id: 'signExt', label: labels.value.signExt }
  ] },
  { id: 'config', icon: 'bi-gear', label: labels.value.config, tab: 'general' }
])

const configTabs = ['general', 'display', 'cloud', 'tray', 'templates', 'validity', 'tree', 'maintenance', 'versions', 'signatures', 'encryption']
</script>

<template>
  <div class="fm-shell" @click="menu = null">
    <aside class="fm-nav">
      <template v-for="item in sections" :key="item.label">
        <button type="button" :class="{ selected: page.section === item.id }" @click="go({ section: item.id, tab: item.tab || page.tab, source: item.id === 'explorer' ? 'ged' : page.source, folder: '' })">
          <i :class="['bi', item.icon]"></i>{{ item.label }}
        </button>
        <div v-if="item.children" class="fm-sub">
          <button v-for="child in item.children" :key="child.label" type="button" :class="{ selected: page.section === child.id && (!child.source || page.source === child.source) }" @click="go({ section: child.id, source: child.source || page.source, folder: '' })">{{ child.label }}</button>
        </div>
      </template>
    </aside>
    <div class="fm-main">
      <p v-if="page.notice" class="message">{{ page.notice }}</p>

      <section v-if="page.section === 'editor' && page.editor" class="pdf-editor">
        <header class="pdf-top">{{ page.editor.name }}</header>
        <div class="pdf-body">
          <div class="pdf-tools">
            <button v-for="item in ['text', 'rect', 'ellipse', 'line', 'highlight', 'stamp', 'sign']" :key="item" type="button" :class="{ selected: tool === item }" :title="labels[item] || item" @click="tool = item"><i class="bi" :class="item === 'text' ? 'bi-type' : item === 'sign' ? 'bi-vector-pen' : item === 'stamp' ? 'bi-stamp' : 'bi-square'"></i></button>
          </div>
          <aside class="pdf-pages">
            <h2>{{ labels.pages }}</h2>
            <button v-for="number in page.editor.pages" :key="number" type="button" :class="{ selected: pdfPage === number }" @click="pdfPage = number">{{ number }}</button>
            <p>{{ page.editor.message }}</p>
          </aside>
          <iframe v-if="page.editor.url" class="pdf-sheet" :src="page.editor.url" :title="page.editor.name"></iframe>
          <p v-else class="opacitymedium">{{ page.editor.message }}</p>
          <form class="pdf-attributes" @submit.prevent="call('pdf', { id: page.editor.id, section: 'editor', preview: page.editor.id, tool, page: pdfPage, note: $event.target.note.value, x: $event.target.x.value, y: $event.target.y.value, other: $event.target.other.value }).catch((cause) => { error.value = cause.message })">
            <h2>{{ labels.attributes }}</h2>
            <p class="opacitymedium">{{ labels.selectHint }}</p>
            <label>{{ labels.text }}<textarea name="note" class="flat" rows="3"></textarea></label>
            <label>{{ labels.page }}<input name="x" class="flat" type="number" value="72" /></label>
            <label>Y<input name="y" class="flat" type="number" value="700" /></label>
            <label>{{ labels.merge }}<input name="other" class="flat" :placeholder="labels.ref" /></label>
            <button class="butAction" type="submit">{{ labels.applyTool }}</button>
            <button class="butAction" type="button" @click="call('pdf', { id: page.editor.id, section: 'editor', preview: page.editor.id, tool: 'split', page: pdfPage }).catch((cause) => { error.value = cause.message })">{{ labels.split }}</button>
            <button class="butAction" type="button" @click="go({ section: 'explorer', preview: '' })">{{ labels.cancel }}</button>
          </form>
        </div>
      </section>

      <section v-else-if="page.section === 'office'" class="fm-panel">
        <h2>{{ labels.office }}</h2>
        <p>{{ page.office?.message }}</p>
        <p v-if="page.office?.name">{{ page.office.name }}</p>
        <p class="opacitymedium">{{ page.office?.detail }} {{ page.office?.formats }}</p>
        <button class="butAction" type="button" @click="go({ section: 'explorer' })">{{ labels.cancel }}</button>
      </section>

      <section v-else-if="page.section === 'config'" class="fm-config">
        <div class="fm-tabs">
          <button v-for="item in configTabs" :key="item" type="button" :class="{ selected: page.tab === item }" @click="go({ section: 'config', tab: item })">{{ labels[item] }}</button>
        </div>
        <form v-if="page.tab === 'general'" class="fm-form" @submit.prevent="call('settings', { section: 'config', tab: 'general', mode: $event.target.mode.value, defaultSource: $event.target.defaultSource.value, order: $event.target.order.value, autoFolder: $event.target.autoFolder.checked, trashDays: $event.target.trashDays.value }).catch((cause) => { error.value = cause.message })">
          <label>{{ labels.mode }}<select name="mode" class="flat"><option value="permissive" :selected="settings.mode === 'permissive'">{{ labels.permissive }}</option><option value="restrictive" :selected="settings.mode === 'restrictive'">{{ labels.restrictive }}</option></select></label>
          <label>{{ labels.defaultSource }}<input name="defaultSource" class="flat" :value="settings.defaultSource" /></label>
          <label>{{ labels.order }}<input name="order" class="flat" :value="settings.order" /></label>
          <label>{{ labels.trashDays }}<input name="trashDays" class="flat" type="number" :value="settings.trashDays" /></label>
          <label><input name="autoFolder" type="checkbox" :checked="settings.autoFolder" /> {{ labels.auto }}</label>
          <p>{{ labels.entity }} : {{ page.diagnostics.entity }}</p>
          <button class="butAction" type="submit">{{ labels.save }}</button>
        </form>
        <form v-else-if="page.tab === 'display'" class="fm-form" @submit.prevent="call('settings', { section: 'config', tab: 'display', defaultView: $event.target.defaultView.value }).catch((cause) => { error.value = cause.message })">
          <label>{{ labels.display }}<select name="defaultView" class="flat"><option value="grid">{{ labels.grid }}</option><option value="list">{{ labels.list }}</option></select></label>
          <button class="butAction" type="submit">{{ labels.save }}</button>
        </form>
        <div v-else-if="page.tab === 'cloud'">
          <h2>{{ labels.connection }}</h2>
          <table class="tagtable liste">
            <thead><tr><th>{{ labels.ref }}</th><th>{{ labels.label }}</th><th>{{ labels.type }}</th><th>{{ labels.server }}</th><th>{{ labels.state }}</th><th>{{ labels.lastTest }}</th><th>{{ labels.actions }}</th></tr></thead>
            <tbody>
              <tr v-for="item in page.storage.filter((row) => row.server)" :key="item.code">
                <td>{{ item.ref }}</td><td>{{ item.title }}</td><td>{{ item.label }}</td><td>{{ item.server }}</td>
                <td><span :class="item.ok ? 'badge badge-open' : 'badge'">{{ item.status }}</span></td>
                <td>{{ item.tested }}</td>
                <td>
                  <button type="button" @click="call('test', { connector: item.code, section: 'config', tab: 'cloud' }).catch((cause) => { error.value = cause.message })">{{ labels.test }}</button>
                  <button type="button" @click="call('clear', { connector: item.code, section: 'config', tab: 'cloud' }).catch((cause) => { error.value = cause.message })">{{ labels.delete }}</button>
                </td>
              </tr>
            </tbody>
          </table>
          <form class="fm-form" @submit.prevent="call('settings', { section: 'config', tab: 'cloud', nextcloudUrl: $event.target.nextcloudUrl.value, nextcloudRef: $event.target.nextcloudRef.value, nextcloudLabel: $event.target.nextcloudLabel.value, s3Url: $event.target.s3Url.value, s3Bucket: $event.target.s3Bucket.value, s3Ref: $event.target.s3Ref.value, s3Label: $event.target.s3Label.value, minioUrl: $event.target.minioUrl.value, gdriveUrl: $event.target.gdriveUrl.value, onedriveUrl: $event.target.onedriveUrl.value, ftpHost: $event.target.ftpHost.value, smbHost: $event.target.smbHost.value }).catch((cause) => { error.value = cause.message })">
            <input name="nextcloudRef" class="flat" :placeholder="labels.ref" />
            <input name="nextcloudLabel" class="flat" placeholder="Nextcloud" />
            <input name="nextcloudUrl" class="flat" placeholder="https://nextcloud" />
            <input name="s3Ref" class="flat" :placeholder="labels.ref" />
            <input name="s3Label" class="flat" placeholder="S3" />
            <input name="s3Url" class="flat" placeholder="https://s3" />
            <input name="s3Bucket" class="flat" placeholder="bucket" />
            <input name="minioUrl" class="flat" placeholder="MinIO" />
            <input name="gdriveUrl" class="flat" placeholder="Google Drive" />
            <input name="onedriveUrl" class="flat" placeholder="OneDrive" />
            <input name="ftpHost" class="flat" placeholder="FTP" />
            <input name="smbHost" class="flat" placeholder="SMB" />
            <button class="butAction" type="submit">{{ labels.save }}</button>
          </form>
          <form class="fm-form" @submit.prevent="call('settings', { section: 'config', tab: 'cloud', collaboraEnabled: $event.target.collaboraEnabled.checked, collaboraUrl: $event.target.collaboraUrl.value, collaboraSsl: $event.target.collaboraSsl.checked, collaboraWopi: $event.target.collaboraWopi.checked, collaboraFormats: $event.target.collaboraFormats.value, collaboraTimeout: $event.target.collaboraTimeout.value, collaboraAuto: $event.target.collaboraAuto.checked }).catch((cause) => { error.value = cause.message })">
            <h2>Collabora Online</h2>
            <label><input name="collaboraEnabled" type="checkbox" :checked="settings.collaboraEnabled" /> {{ labels.collaboraOn }}</label>
            <label>{{ labels.collaboraUrl }}<input name="collaboraUrl" class="flat" :value="(page.connectors.find((item) => item.code === 'collabora') || {}).url" /></label>
            <label><input name="collaboraSsl" type="checkbox" :checked="settings.collaboraSsl" /> {{ labels.sslOff }}</label>
            <label><input name="collaboraWopi" type="checkbox" :checked="settings.collaboraWopi" /> {{ labels.wopi }}</label>
            <label>{{ labels.formats }}<input name="collaboraFormats" class="flat" :value="settings.collaboraFormats" /></label>
            <label>{{ labels.timeout }}<input name="collaboraTimeout" class="flat" type="number" :value="settings.collaboraTimeout" /> {{ labels.seconds }}</label>
            <label><input name="collaboraAuto" type="checkbox" :checked="settings.collaboraAuto" /> {{ labels.autoOpen }}</label>
            <button class="butAction" type="submit">{{ labels.save }}</button>
            <button class="butAction" type="button" @click="call('test', { connector: 'collabora', section: 'config', tab: 'cloud' }).catch((cause) => { error.value = cause.message })">{{ labels.test }}</button>
          </form>
        </div>
        <div v-else-if="page.tab === 'signatures'">
          <div class="fm-tabs">
            <button v-for="item in ['seals', 'providers', 'reminders', 'display', 'certificates', 'objects', 'security']" :key="item" type="button" :class="{ selected: page.panel === item }" @click="go({ section: 'config', tab: 'signatures', panel: item })">{{ labels[item] }}</button>
          </div>
          <form class="fm-form" @submit.prevent="call('settings', { section: 'config', tab: 'signatures', panel: 'security', otpEnabled: $event.target.otpEnabled.checked, otpMinutes: $event.target.otpMinutes.value, otpSession: $event.target.otpSession.value, otpTries: $event.target.otpTries.value, eidasLevel: $event.target.eidasLevel.value, eidasBadge: $event.target.eidasBadge.checked, docusealUrl: $event.target.docusealUrl.value, yousignUrl: $event.target.yousignUrl.value, reminderDays: $event.target.reminderDays.value }).catch((cause) => { error.value = cause.message })">
            <h2>{{ labels.otp }}</h2>
            <table class="tagtable liste">
              <tbody>
                <tr><td>{{ labels.otpOn }}</td><td><input name="otpEnabled" type="checkbox" :checked="settings.otpEnabled" /></td><td class="opacitymedium">{{ labels.mail }}</td></tr>
                <tr><td>{{ labels.otpMinutes }}</td><td><input name="otpMinutes" class="flat" type="number" :value="settings.otpMinutes" /></td><td></td></tr>
                <tr><td>{{ labels.otpSession }}</td><td><input name="otpSession" class="flat" type="number" :value="settings.otpSession" /></td><td></td></tr>
                <tr><td>{{ labels.otpTries }}</td><td><input name="otpTries" class="flat" type="number" :value="settings.otpTries" /></td><td></td></tr>
              </tbody>
            </table>
            <h2>{{ labels.eidas }}</h2>
            <label>{{ labels.eidasLevel }}
              <select name="eidasLevel" class="flat">
                <option value="simple">{{ labels.levelSimple }}</option>
                <option value="advanced" :selected="settings.eidasLevel === 'advanced'">{{ labels.levelAdvanced }}</option>
                <option value="qualified">{{ labels.levelQualified }}</option>
              </select>
            </label>
            <label><input name="eidasBadge" type="checkbox" :checked="settings.eidasBadge" /> {{ labels.eidasBadge }}</label>
            <p class="opacitymedium">{{ labels.qualifiedNote }}</p>
            <h2>{{ labels.providers }}</h2>
            <input name="docusealUrl" class="flat" placeholder="DocuSeal" :value="(page.connectors.find((item) => item.code === 'docuseal') || {}).url" />
            <input name="yousignUrl" class="flat" placeholder="Yousign" :value="(page.connectors.find((item) => item.code === 'yousign') || {}).url" />
            <p class="opacitymedium">{{ labels.signExternal }}</p>
            <h2>{{ labels.reminders }}</h2>
            <label>{{ labels.reminderDays }}<input name="reminderDays" class="flat" type="number" :value="settings.reminderDays" /></label>
            <p class="opacitymedium">{{ labels.manualReminder }}</p>
            <p class="opacitymedium">{{ labels.noCert }}</p>
            <button class="butAction" type="submit">{{ labels.save }}</button>
          </form>
          <h2>{{ labels.trace }}</h2>
          <p v-for="(row, index) in page.audit" :key="index">{{ row.at }} {{ row.actor }} {{ row.action }} {{ row.name }}</p>
        </div>
        <form v-else-if="page.tab === 'templates' || page.tab === 'tree'" class="fm-form" @submit.prevent="call('template', { section: 'config', tab: page.tab, name: $event.target.name.value, paths: $event.target.paths.value }).catch((cause) => { error.value = cause.message })">
          <input name="name" class="flat" :placeholder="labels.templates" required />
          <textarea name="paths" class="flat" rows="4"></textarea>
          <button class="butAction" type="submit">{{ labels.save }}</button>
          <p v-for="item in page.templates" :key="item.name">{{ item.name }} — {{ (item.paths || []).join(', ') }}</p>
        </form>
        <form v-else-if="page.tab === 'tray'" class="fm-form" @submit.prevent="call('settings', { section: 'config', tab: 'tray', autoFolder: $event.target.autoFolder.checked, autoOwners: $event.target.autoOwners.value }).catch((cause) => { error.value = cause.message })">
          <label><input name="autoFolder" type="checkbox" :checked="settings.autoFolder" /> {{ labels.auto }}</label>
          <label>{{ labels.byObject }}<input name="autoOwners" class="flat" :value="settings.autoOwners" /></label>
          <button class="butAction" type="submit">{{ labels.save }}</button>
        </form>
        <form v-else-if="page.tab === 'validity'" class="fm-form" @submit.prevent="call('settings', { section: 'config', tab: 'validity', reminderDays: $event.target.reminderDays.value }).catch((cause) => { error.value = cause.message })">
          <label>{{ labels.reminderDays }}<input name="reminderDays" class="flat" type="number" :value="settings.reminderDays" /></label>
          <p class="opacitymedium">{{ labels.manualReminder }}</p>
          <button class="butAction" type="submit">{{ labels.save }}</button>
        </form>
        <div v-else-if="page.tab === 'maintenance'">
          <p>{{ labels.diagnostics }} : {{ page.diagnostics.files }} / {{ labels.trash }} {{ page.diagnostics.trash }}</p>
          <button class="butAction" type="button" @click="call('purge', { section: 'config', tab: 'maintenance' }).catch((cause) => { error.value = cause.message })">{{ labels.purge }}</button>
          <button class="butAction" type="button" @click="backup().catch((cause) => { error.value = cause.message })">{{ labels.backup }}</button>
        </div>
        <div v-else-if="page.tab === 'versions'">
          <p v-for="node in page.nodes.filter((item) => item.version > 1)" :key="node.id">{{ node.name }} — v{{ node.version }}</p>
          <template v-if="page.preview"><p v-for="version in page.preview.versions" :key="version.id">{{ version.at }} {{ version.by }} {{ version.note }}</p></template>
        </div>
        <form v-else class="fm-form" @submit.prevent="call('settings', { section: 'config', tab: 'encryption', encrypt: $event.target.encrypt.checked }).catch((cause) => { error.value = cause.message })">
          <label><input name="encrypt" type="checkbox" :checked="settings.encrypt" /> {{ labels.encryptOn }}</label>
          <button class="butAction" type="submit">{{ labels.save }}</button>
        </form>
      </section>

      <section v-else-if="page.section === 'validity' || page.section === 'validityNew'">
        <h2>{{ labels.validity }}</h2>
        <p class="opacitymedium">{{ labels.manualReminder }}</p>
        <form v-if="page.preview" class="fm-form" @submit.prevent="call('meta', { id: page.preview.id, section: 'validity', expires: $event.target.expires.value, docType: $event.target.docType.value }).catch((cause) => { error.value = cause.message })">
          <select name="docType" class="flat"><option v-for="item in page.docTypes" :key="item" :value="item">{{ item }}</option></select>
          <input name="expires" class="flat" type="date" :value="page.preview.expires || ''" />
          <button class="butAction" type="submit">{{ labels.addValidity }}</button>
        </form>
        <p v-for="item in page.expiring" :key="item.id"><button type="button" @click="go({ section: 'validity', preview: item.id })">{{ item.name }}</button> — {{ item.expires }} {{ item.docType }}</p>
        <p v-if="!page.expiring.length" class="opacitymedium">{{ labels.empty }}</p>
      </section>

      <section v-else-if="page.section === 'docTypes'">
        <h2>{{ labels.docTypes }}</h2>
        <form class="fm-form" @submit.prevent="call('doctype', { section: 'docTypes', name: $event.target.name.value }).then(() => $event.target.reset()).catch((cause) => { error.value = cause.message })">
          <input name="name" class="flat" required />
          <button class="butAction" type="submit">{{ labels.save }}</button>
        </form>
        <p v-for="item in page.docTypes" :key="item">{{ item }} <button type="button" @click="call('dropType', { section: 'docTypes', name: item }).catch((cause) => { error.value = cause.message })">{{ labels.delete }}</button></p>
      </section>

      <section v-else-if="page.section === 'requestsIn' || page.section === 'requestsOut'">
        <h2>{{ page.section === 'requestsIn' ? labels.requestsIn : labels.requestsOut }}</h2>
        <p v-for="item in (page.section === 'requestsOut' ? page.requestsOut : page.requests)" :key="item.id">
          {{ item.user }} — {{ item.name }} — {{ item.status }}
          <template v-if="item.status === 'pending'">
            <button type="button" @click="call('decide', { id: item.id, accept: true, section: page.section }).catch((cause) => { error.value = cause.message })">{{ labels.approve }}</button>
            <button type="button" @click="call('decide', { id: item.id, accept: false, section: page.section }).catch((cause) => { error.value = cause.message })">{{ labels.refuse }}</button>
          </template>
        </p>
        <button v-if="page.folder" class="butAction" type="button" @click="call('request', { id: page.folder, section: 'requestsOut', message: '' }).catch((cause) => { error.value = cause.message })">{{ labels.request }}</button>
      </section>

      <section v-else-if="page.section === 'shares'">
        <h2>{{ labels.myShares }}</h2>
        <p v-for="item in page.shares" :key="item.id">{{ item.shareTitle || item.name }} — {{ item.recipients }} — {{ item.until }}</p>
        <p v-if="!page.shares.length" class="opacitymedium">{{ labels.empty }}</p>
      </section>

      <section v-else-if="page.section === 'signNew' || page.section === 'signOut' || page.section === 'signIn' || page.section === 'signExt'">
        <h2>{{ labels.signatures }}</h2>
        <p class="opacitymedium">{{ labels.signInternal }} {{ labels.qualifiedNote }}</p>
        <form v-if="page.preview" class="fm-form" @submit.prevent="call('sign', { id: page.preview.id, section: page.section, provider: $event.target.provider.value, note: $event.target.note.value }).catch((cause) => { error.value = cause.message })">
          <select name="provider" class="flat"><option value="internal">{{ labels.sign }}</option><option value="docuseal">DocuSeal</option><option value="yousign">Yousign</option></select>
          <textarea name="note" class="flat" rows="3"></textarea>
          <button class="butAction" type="submit">{{ labels.sign }}</button>
        </form>
        <p v-for="item in page.signatures.filter((row) => page.section !== 'signExt' || row.provider !== 'internal')" :key="item.id">{{ item.name }} — {{ item.provider }} — {{ item.signedAt }} <span v-if="settings.eidasBadge" class="badge">{{ item.level }}</span></p>
      </section>

      <section v-else-if="page.section === 'upload'" class="fm-panel">
        <h2>{{ labels.newDoc }}</h2>
        <form class="fm-form" @submit.prevent="upload($event).catch((cause) => { error.value = cause.message })">
          <input name="upload" class="flat" type="file" required />
          <button class="butAction" type="submit">{{ labels.upload }}</button>
        </form>
      </section>

      <section v-else class="fm-explorer" :class="page.view">
        <div class="fm-source-tabs">
          <button type="button" :class="{ selected: page.source === 'erp' }" @click="go({ source: 'erp', folder: '' })">{{ labels.erp }}</button>
          <button type="button" :class="{ selected: page.source === 'ged' }" @click="go({ source: 'ged', folder: '' })">{{ labels.ged }}</button>
          <button v-for="item in page.sources.filter((row) => !['erp', 'ged'].includes(row.code))" :key="item.code" type="button" :class="{ selected: page.source === item.code }" @click="go({ source: item.code, folder: '' })">{{ item.label }}</button>
        </div>
        <div class="fm-toolbar">
          <button type="button" @click="go({ folder: page.crumbs.length > 1 ? page.crumbs[page.crumbs.length - 2].id : '' })"><i class="bi bi-arrow-left"></i></button>
          <button type="button" @click="go({})"><i class="bi bi-arrow-clockwise"></i></button>
          <form @submit.prevent="upload($event).catch((cause) => { error.value = cause.message })"><input name="upload" type="file" required /><button type="submit"><i class="bi bi-cloud-upload"></i></button></form>
          <form @submit.prevent="call('mkdir', { name: $event.target.name.value, section: 'explorer' }).then(() => $event.target.reset()).catch((cause) => { error.value = cause.message })"><input name="name" class="flat" :placeholder="labels.folder" required /><button type="submit"><i class="bi bi-folder-plus"></i></button></form>
          <form class="fm-search" @submit.prevent="go({ q: page.q })"><input v-model="page.q" class="flat" :placeholder="labels.search" /></form>
          <button type="button" @click="go({ view: page.view === 'grid' ? 'list' : 'grid' })"><i class="bi" :class="page.view === 'grid' ? 'bi-list' : 'bi-grid'"></i></button>
        </div>
        <p class="fm-crumbs">
          <button type="button" @click="go({ folder: '' })">ECM</button>
          <template v-for="crumb in page.crumbs" :key="crumb.id"> / <button type="button" @click="go({ folder: crumb.id })">{{ crumb.name }}</button></template>
        </p>
        <div class="fm-grid">
          <article v-for="node in page.nodes" :key="node.id" @contextmenu.prevent="openMenu($event, node)" @dblclick="node.kind === 'folder' ? go({ folder: node.id }) : (node.pdf ? go({ section: 'editor', preview: node.id, id: node.id }) : go({ preview: node.id }))">
            <i :class="['bi', node.icon || 'bi-file-earmark']" :style="{ color: node.color || '#6c757d' }"></i>
            <span>{{ node.name }}</span>
            <button type="button" class="fm-more" @click.stop="openMenu($event, node)">...</button>
          </article>
          <p v-if="!page.nodes.length" class="opacitymedium">{{ labels.empty }}</p>
        </div>
        <aside v-if="page.preview && page.section === 'explorer'" class="library-preview">
          <h2>{{ page.preview.name }}</h2>
          <img v-if="page.preview.mime && page.preview.mime.startsWith('image/')" :src="page.preview.url" :alt="page.preview.name" />
          <iframe v-else-if="page.preview.mime === 'application/pdf'" :src="page.preview.url" :title="page.preview.name"></iframe>
          <p v-if="page.preview.shareLink">{{ labels.link }} : <a :href="page.preview.shareLink">{{ page.preview.shareLink }}</a></p>
          <ul><li v-for="version in page.preview.versions" :key="version.id">{{ version.at }} {{ version.note }} <button type="button" @click="call('revert', { id: page.preview.id, version: version.id, preview: page.preview.id }).catch((cause) => { error.value = cause.message })">{{ labels.restore }}</button></li></ul>
        </aside>
      </section>
    </div>

    <div v-if="menu" class="fm-menu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }" @click.stop>
      <button type="button" @click="menu.node.kind === 'folder' ? go({ folder: menu.node.id }) : go({ preview: menu.node.id })">{{ labels.open }}</button>
      <button type="button" @click="go({ preview: menu.node.id })">{{ labels.preview }}</button>
      <button v-if="menu.node.pdf" type="button" @click="go({ section: 'editor', preview: menu.node.id, id: menu.node.id })">{{ labels.editPdf }}</button>
      <button v-if="menu.node.office" type="button" @click="go({ section: 'office', preview: menu.node.id, id: menu.node.id })">{{ labels.office }}</button>
      <button v-if="menu.node.pdf" type="button" @click="show('pdf', menu.node)">{{ labels.pdfTools }}</button>
      <a :href="`/api/plugins/filemanager/raw/${menu.node.id}`">{{ labels.download }}</a>
      <button type="button" @click="show('mail', menu.node)">{{ labels.sendMail }}</button>
      <button v-if="!menu.node.virtual" type="button" @click="show('share', menu.node)">{{ labels.shareTitle }}</button>
      <button v-if="!menu.node.virtual" type="button" @click="show('sign', menu.node)">{{ labels.signatures }}</button>
      <button v-if="!menu.node.virtual" type="button" @click="show('rename', menu.node)">{{ labels.rename }}</button>
      <button v-if="menu.node.kind === 'folder'" type="button" @click="show('appearance', menu.node)">{{ labels.customize }}</button>
      <button v-if="!menu.node.virtual" type="button" @click="call(menu.node.trashed ? 'restore' : 'trash', { id: menu.node.id }).catch((cause) => { error.value = cause.message })">{{ menu.node.trashed ? labels.restore : labels.delete }}</button>
      <button type="button" @click="show('validity', menu.node)">{{ labels.addValidity }}</button>
      <button type="button" @click="go({ preview: menu.node.id })">{{ labels.fileVersions }}</button>
    </div>

    <div v-if="dialog" class="fm-dialog-back" @click.self="dialog = null">
      <form v-if="dialog === 'share'" class="fm-dialog" @submit.prevent="submitDialog($event, 'share', { section: 'shares' })">
        <h2>{{ labels.shareTitle }}</h2>
        <p>{{ dialogNode.name }}</p>
        <label>{{ labels.shareName }}<input name="title" class="flat" :value="dialogNode.name" /></label>
        <label>{{ labels.recipients }}<input name="recipients" class="flat" placeholder="client@example.com" /></label>
        <label>{{ labels.until }}<input name="until" class="flat" type="date" /></label>
        <label>{{ labels.password }}<input name="password" class="flat" /></label>
        <label>{{ labels.downloadMax }}<input name="maxDownloads" class="flat" /></label>
        <label><input name="notify" type="checkbox" value="1" /> {{ labels.notify }}</label>
        <textarea name="message" class="flat" rows="3"></textarea>
        <p class="opacitymedium">{{ labels.mail }}</p>
        <button type="button" @click="dialog = null">{{ labels.cancel }}</button>
        <button class="butAction" type="submit">{{ labels.createShare }}</button>
      </form>
      <form v-else-if="dialog === 'appearance'" class="fm-dialog" @submit.prevent="submitDialog($event, 'appearance')">
        <h2>{{ labels.customize }}</h2>
        <p>{{ labels.color }}</p>
        <div class="fm-swatches">
          <label v-for="color in page.colors" :key="color"><input type="radio" name="color" :value="color" :checked="color === dialogNode.color" /><span :style="{ background: color }"></span></label>
        </div>
        <p>{{ labels.icon }}</p>
        <div class="fm-icons">
          <label v-for="icon in page.icons" :key="icon"><input type="radio" name="icon" :value="icon" :checked="icon === dialogNode.icon" /><i :class="['bi', icon]"></i></label>
        </div>
        <p class="fm-note">{{ labels.visibleAll }}</p>
        <button type="button" @click="call('appearance', { id: dialogNode.id, reset: true }).then(() => { dialog = null }).catch((cause) => { error.value = cause.message })">{{ labels.reset }}</button>
        <button type="button" @click="dialog = null">{{ labels.cancel }}</button>
        <button class="butAction" type="submit">{{ labels.save }}</button>
      </form>
      <form v-else-if="dialog === 'rename'" class="fm-dialog" @submit.prevent="submitDialog($event, 'rename')">
        <h2>{{ labels.rename }}</h2>
        <input name="name" class="flat" :value="dialogNode.name" required />
        <button class="butAction" type="submit">{{ labels.save }}</button>
      </form>
      <form v-else-if="dialog === 'mail'" class="fm-dialog" @submit.prevent="submitDialog($event, 'email')">
        <h2>{{ labels.sendMail }}</h2>
        <input name="to" class="flat" placeholder="client@example.com" />
        <textarea name="body" class="flat" rows="4"></textarea>
        <p class="opacitymedium">{{ labels.mail }}</p>
        <button class="butAction" type="submit">{{ labels.save }}</button>
      </form>
      <form v-else-if="dialog === 'sign'" class="fm-dialog" @submit.prevent="submitDialog($event, 'sign')">
        <h2>{{ labels.signatures }}</h2>
        <select name="provider" class="flat"><option value="internal">{{ labels.sign }}</option><option value="docuseal">DocuSeal</option><option value="yousign">Yousign</option></select>
        <textarea name="note" class="flat" rows="3"></textarea>
        <p class="opacitymedium">{{ labels.qualifiedNote }}</p>
        <button class="butAction" type="submit">{{ labels.sign }}</button>
      </form>
      <form v-else-if="dialog === 'validity'" class="fm-dialog" @submit.prevent="submitDialog($event, 'meta', { section: 'validity' })">
        <h2>{{ labels.addValidity }}</h2>
        <select name="docType" class="flat"><option v-for="item in page.docTypes" :key="item" :value="item">{{ item }}</option></select>
        <input name="expires" class="flat" type="date" required />
        <button class="butAction" type="submit">{{ labels.save }}</button>
      </form>
      <form v-else class="fm-dialog" @submit.prevent="submitDialog($event, 'pdf', { section: 'editor', preview: dialogNode.id, tool: $event.target.tool.value })">
        <h2>{{ labels.pdfTools }}</h2>
        <select name="tool" class="flat"><option value="text">{{ labels.text }}</option><option value="stamp">{{ labels.stamp }}</option><option value="split">{{ labels.split }}</option></select>
        <textarea name="note" class="flat" rows="3"></textarea>
        <button class="butAction" type="submit">{{ labels.applyTool }}</button>
      </form>
    </div>
  </div>
</template>
