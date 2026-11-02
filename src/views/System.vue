<script setup>
import { inject, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api'
import { href } from '../nav'

const route = useRoute()
const locale = inject('locale')
const nav = inject('nav')
const error = inject('error')
const reloadNav = inject('reloadNav')
const page = ref(null)
const values = reactive({})
const payload = ref('')
const notice = ref('')

async function load() {
  error.value = ''
  notice.value = ''
  page.value = await api(`/api/system/${route.params.id}`, { locale: locale.value })
  Object.keys(values).forEach((key) => delete values[key])
  for (const field of page.value.fields || []) {
    values[field.name] = field.type === 'bool' ? field.value === '1' || field.value === 'true' : (field.value ?? '')
  }
  if (page.value.kind === 'vat') {
    values.fromRate = page.value.fromRate
    values.toRate = page.value.toRate
  }
  if (page.value.kind === 'purge') {
    values.days = page.value.days
  }
  if (page.value.kind === 'menus') {
    for (const group of page.value.groups || []) {
      for (const entry of group.entries) {
        values[`hide_${entry.id}`] = !!entry.hidden
      }
    }
  }
}

function connector(code) {
  return (page.value?.connectors || []).find((item) => item.code === code) || {}
}

async function save() {
  const body = page.value.kind === 'restore' ? { payload: payload.value } : { ...values }
  const saved = await api(`/api/system/${route.params.id}`, { locale: locale.value, method: 'POST', body })
  const text = saved.notice || nav.value.chrome['action.saved']
  await reloadNav()
  await load()
  notice.value = text
  if (page.value) page.value.notice = text
}

const libraryView = ref('list')

async function libraryCall(verb, extra = {}) {
  const current = page.value || {}
  const result = await api(`/api/plugins/filemanager/${verb}`, {
    locale: locale.value,
    method: 'POST',
    body: { source: current.source, folder: current.folder || '', q: current.q || '', ...extra }
  })
  page.value = { ...result, title: current.title, icon: current.icon, id: current.id }
}

async function libraryUpload(event, verb = 'upload') {
  const data = new FormData(event.target)
  data.set('source', page.value.source || '')
  data.set('folder', page.value.folder || '')
  if (verb === 'version' && page.value.preview?.id) data.set('id', page.value.preview.id)
  const response = await fetch(`/api/plugins/filemanager/${verb}?lang=${encodeURIComponent(locale.value)}`, { method: 'POST', credentials: 'include', body: data })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || response.statusText)
  page.value = { ...result, title: page.value.title, icon: page.value.icon, id: page.value.id }
  event.target.reset()
}

async function libraryBackup() {
  const result = await api('/api/plugins/filemanager/backup', { locale: locale.value, method: 'POST', body: {} })
  const blob = new Blob([result.json || ''], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'filemanager-backup.json'
  link.click()
  URL.revokeObjectURL(url)
}

onMounted(() => load().catch((cause) => { error.value = cause.message }))
watch(() => route.params.id, () => load().catch((cause) => { error.value = cause.message }))
</script>

<template>
  <div v-if="page">
    <table class="table-fiche-title">
      <tbody>
        <tr class="toptitle">
          <td class="col-title"><div class="titre"><i :class="['bi', page.icon || 'bi-sliders']"></i>{{ page.title }}</div></td>
        </tr>
      </tbody>
    </table>
    <p v-if="page.notice" class="message">{{ page.notice }}</p>
    <p v-for="alert in page.alerts || []" :key="alert" class="error">{{ alert }}</p>
    <p v-if="page.hint" class="opacitymedium">{{ page.hint }}</p>

    <div v-if="page.kind === 'summary'" class="box-grid">
      <router-link v-for="(card, index) in page.cards" :key="card.id" class="info-box" :to="href(card)">
        <span class="info-box-icon" :class="'bg' + ((index % 6) + 1)"><i :class="['bi', card.icon || 'bi-sliders']"></i></span>
        <span class="info-box-content"><span class="info-box-title">{{ card.label }}</span></span>
      </router-link>
    </div>

    <form v-else-if="page.kind === 'setup'" @submit.prevent="save().catch((cause) => { error.value = cause.message })">
      <table class="border">
        <tbody>
          <tr v-for="field in page.fields" :key="field.name">
            <td class="titlefield"><label :for="'field-' + field.name">{{ field.label }}</label></td>
            <td>
              <textarea v-if="field.type === 'area'" :id="'field-' + field.name" v-model="values[field.name]" class="flat" rows="3"></textarea>
              <input v-else-if="field.type === 'bool'" :id="'field-' + field.name" v-model="values[field.name]" class="flat" type="checkbox" />
              <select v-else-if="field.type === 'choice'" :id="'field-' + field.name" v-model="values[field.name]" class="flat">
                <option value=""></option>
                <option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <input v-else-if="field.type === 'number'" :id="'field-' + field.name" v-model="values[field.name]" class="flat" type="number" step="any" />
              <input v-else :id="'field-' + field.name" v-model="values[field.name]" class="flat" type="text" />
            </td>
          </tr>
        </tbody>
      </table>
      <div class="tabsAction"><button class="butAction" type="submit">{{ nav.chrome['action.save'] }}</button></div>
    </form>

    <div v-else-if="page.kind === 'checks'">
      <table class="tagtable liste">
        <thead>
          <tr class="liste_titre">
            <th v-for="column in page.columns" :key="column">{{ column }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="check in page.checks" :key="check.label" class="oddeven">
            <td>{{ check.label }}</td>
            <td>{{ check.state }}</td>
            <td>{{ check.detail }}</td>
          </tr>
        </tbody>
      </table>
      <p>{{ page.apiLabel }} : <span class="badge">{{ page.apiUrl }}</span></p>
      <p class="message">{{ page.verdict }}</p>
    </div>

    <div v-else-if="page.kind === 'info'">
      <section v-for="section in page.sections" :key="section.title">
        <h2 class="opacitymedium">{{ section.title }}</h2>
        <table class="border">
          <tbody>
            <tr v-for="row in section.rows" :key="row.label">
              <td class="titlefield">{{ row.label }}</td>
              <td>
                <a v-if="row.href" :href="row.href" target="_blank" rel="noopener">{{ row.value }}</a>
                <template v-else>{{ row.value }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <form v-else-if="page.kind === 'menus'" @submit.prevent="save().catch((cause) => { error.value = cause.message })">
      <section v-for="group in page.groups" :key="group.label">
        <h2 class="opacitymedium">{{ group.label }}</h2>
        <table class="border">
          <tbody>
            <tr v-for="entry in group.entries" :key="entry.id">
              <td class="titlefield" :style="{ paddingLeft: `${(entry.level || 1) * 16}px` }">{{ entry.label }}</td>
              <td>
                <label>
                  <input v-model="values['hide_' + entry.id]" type="checkbox" :disabled="entry.locked" />
                  {{ nav.chrome['menu.hide'] || 'Masquer' }}
                </label>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
      <div class="tabsAction"><button class="butAction" type="submit">{{ nav.chrome['action.save'] }}</button></div>
    </form>

    <table v-else-if="page.kind === 'dictionaries'" class="tagtable liste">
      <tbody>
        <tr v-for="entry in page.entries" :key="entry.id" class="oddeven">
          <td><router-link :to="href(entry)">{{ entry.label }}</router-link></td>
        </tr>
      </tbody>
    </table>

    <p v-else-if="page.kind === 'backup'">
      <a class="butAction" href="/api/admin/backup">{{ nav.chrome['action.download'] }}</a>
    </p>

    <form v-else-if="page.kind === 'restore'" @submit.prevent="save().catch((cause) => { error.value = cause.message })">
      <textarea v-model="payload" class="flat" rows="8" style="width: 100%"></textarea>
      <div class="tabsAction"><button class="butAction" type="submit">{{ nav.chrome['action.restore'] }}</button></div>
    </form>

    <form v-else-if="page.kind === 'purge'" @submit.prevent="save().catch((cause) => { error.value = cause.message })">
      <table class="border">
        <tbody>
          <tr>
            <td class="titlefield"><label for="days">{{ nav.chrome['setup.purgeDays'] }}</label></td>
            <td><input id="days" v-model="values.days" class="flat" type="number" /></td>
          </tr>
        </tbody>
      </table>
      <div class="tabsAction"><button class="butActionDelete" type="submit">{{ nav.chrome['action.purge'] }}</button></div>
    </form>

    <div v-else-if="page.kind === 'library'" class="library" :class="libraryView">
      <div class="library-sources">
        <button v-for="item in page.sources" :key="item.code" type="button" class="butAction" :class="{ selected: item.code === page.source }" @click="libraryCall('list', { source: item.code, folder: '' }).catch((cause) => { error.value = cause.message })">{{ item.label }}</button>
      </div>
      <p class="library-crumbs">
        <button type="button" @click="libraryCall('list', { folder: '' }).catch((cause) => { error.value = cause.message })">{{ page.labels.ged }}</button>
        <template v-for="crumb in page.crumbs" :key="crumb.id">
          / <button type="button" @click="libraryCall('list', { folder: crumb.id }).catch((cause) => { error.value = cause.message })">{{ crumb.name }}</button>
        </template>
      </p>
      <form class="library-tools" @submit.prevent="libraryCall('list', { q: page.q }).catch((cause) => { error.value = cause.message })">
        <input v-model="page.q" class="flat" :placeholder="page.labels.search" />
        <button class="butAction" type="submit">{{ page.labels.search }}</button>
        <button class="butAction" type="button" @click="libraryView = libraryView === 'grid' ? 'list' : 'grid'">{{ libraryView === 'grid' ? page.labels.list : page.labels.grid }}</button>
      </form>
      <form class="library-tools" @submit.prevent="libraryUpload($event)">
        <input name="upload" class="flat" type="file" required />
        <button class="butAction" type="submit">{{ page.labels.upload }}</button>
      </form>
      <form class="library-tools" @submit.prevent="libraryCall('mkdir', { name: $event.target.name.value }).then(() => $event.target.reset()).catch((cause) => { error.value = cause.message })">
        <input name="name" class="flat" :placeholder="page.labels.folder" required />
        <button class="butAction" type="submit">{{ page.labels.folder }}</button>
      </form>
      <p v-if="page.locked" class="error">{{ page.labels.request }}</p>
      <div class="library-nodes">
        <article v-for="node in page.nodes" :key="node.id">
          <button v-if="node.kind === 'folder'" type="button" class="perm-folder" @click="libraryCall('list', { folder: node.id }).catch((cause) => { error.value = cause.message })"><i class="bi bi-folder2"></i>{{ node.name }}</button>
          <a v-else-if="node.url && node.kind === 'shortcut'" :href="node.url" target="_blank" rel="noopener">{{ node.name }}</a>
          <button v-else type="button" @click="libraryCall('list', { preview: node.id }).catch((cause) => { error.value = cause.message })">{{ node.name }}</button>
          <span class="opacitymedium">{{ node.kind }} · v{{ node.version }}<template v-if="node.expires"> · {{ node.expires }}</template><template v-if="node.signed"> · {{ page.labels.sign }}</template></span>
          <span class="row-actions" v-if="!node.virtual">
            <a :href="`/api/plugins/filemanager/raw/${node.id}`">{{ page.labels.download }}</a>
            <button type="button" @click="libraryCall('favorite', { id: node.id }).catch((cause) => { error.value = cause.message })">{{ page.labels.favorite }}</button>
            <button type="button" @click="libraryCall(node.trashed ? 'restore' : 'trash', { id: node.id }).catch((cause) => { error.value = cause.message })">{{ node.trashed ? page.labels.restore : page.labels.trash }}</button>
            <button v-if="node.trashed" type="button" @click="libraryCall('delete', { id: node.id }).catch((cause) => { error.value = cause.message })">{{ page.labels.delete }}</button>
          </span>
          <a v-else :href="`/api/plugins/filemanager/raw/${node.id}`">{{ page.labels.download }}</a>
        </article>
        <p v-if="!page.nodes.length" class="opacitymedium">{{ page.labels.empty }}</p>
      </div>
      <aside v-if="page.preview" class="library-preview">
        <h2>{{ page.preview.name }}</h2>
        <img v-if="page.preview.mime && page.preview.mime.startsWith('image/')" :src="page.preview.url" :alt="page.preview.name" />
        <iframe v-else-if="page.preview.mime === 'application/pdf'" :src="page.preview.url" title="pdf"></iframe>
        <p v-else class="opacitymedium">{{ page.labels.preview }}</p>
        <p v-if="page.preview.external">{{ page.preview.external }}</p>
        <p v-if="page.preview.stirling">{{ page.preview.stirling }}</p>
        <p v-if="page.preview.shareLink">{{ page.labels.link }} : <a :href="page.preview.shareLink">{{ page.preview.shareLink }}</a></p>
        <p v-if="page.preview.signature">{{ page.labels.signInternal }} — {{ page.preview.signature.by }} {{ page.preview.signature.at }}</p>
        <ul>
          <li v-for="(note, index) in page.preview.annotations" :key="index">{{ note.at }} {{ note.by }} — {{ note.text }}</li>
          <li v-for="version in page.preview.versions" :key="version.id">v {{ version.at }} {{ version.objectRef }} {{ version.objectStatus }} {{ version.note }}</li>
        </ul>
        <form class="library-tools" @submit.prevent="libraryCall('rename', { id: page.preview.id, name: $event.target.name.value }).catch((cause) => { error.value = cause.message })">
          <input name="name" class="flat" :value="page.preview.name" required />
          <button class="butAction" type="submit">{{ page.labels.rename }}</button>
        </form>
        <form class="library-tools" @submit.prevent="libraryCall('meta', { id: page.preview.id, expires: $event.target.expires.value, docType: $event.target.docType.value }).catch((cause) => { error.value = cause.message })">
          <input name="docType" class="flat" :placeholder="page.labels.type" :value="page.preview.docType || ''" />
          <input name="expires" class="flat" type="date" :value="page.preview.expires || ''" />
          <button class="butAction" type="submit">{{ page.labels.validity }}</button>
        </form>
        <form class="library-tools" @submit.prevent="libraryCall('share', { id: page.preview.id, password: $event.target.password.value, until: $event.target.until.value, recipients: $event.target.recipients.value }).catch((cause) => { error.value = cause.message })">
          <input name="password" class="flat" type="text" :placeholder="page.labels.password" />
          <input name="until" class="flat" type="date" />
          <input name="recipients" class="flat" :placeholder="page.labels.recipients" />
          <button class="butAction" type="submit">{{ page.labels.share }}</button>
        </form>
        <form class="library-tools" @submit.prevent="libraryCall('sign', { id: page.preview.id, provider: $event.target.provider.value, note: $event.target.note.value }).catch((cause) => { error.value = cause.message })">
          <select name="provider" class="flat"><option value="internal">{{ page.labels.sign }}</option><option value="docuseal">DocuSeal</option><option value="yousign">Yousign</option></select>
          <input name="note" class="flat" :placeholder="page.labels.note" />
          <button class="butAction" type="submit">{{ page.labels.sign }}</button>
        </form>
        <form class="library-tools" @submit.prevent="libraryCall('annotate', { id: page.preview.id, note: $event.target.note.value }).catch((cause) => { error.value = cause.message })">
          <input name="note" class="flat" :placeholder="page.labels.annotation" required />
          <button class="butAction" type="submit">{{ page.labels.annotation }}</button>
        </form>
        <form class="library-tools" @submit.prevent="libraryCall('stamp', { id: page.preview.id, note: $event.target.note.value }).catch((cause) => { error.value = cause.message })">
          <input name="note" class="flat" :placeholder="page.labels.stamp" required />
          <button class="butAction" type="submit">{{ page.labels.stamp }}</button>
        </form>
        <form class="library-tools" @submit.prevent="libraryUpload($event, 'version')">
          <input name="upload" class="flat" type="file" required />
          <button class="butAction" type="submit">{{ page.labels.version }}</button>
        </form>
        <form class="library-tools" @submit.prevent="libraryCall('move', { id: page.preview.id, target: $event.target.target.value }).catch((cause) => { error.value = cause.message })">
          <input name="target" class="flat" :placeholder="page.labels.move" />
          <button class="butAction" type="submit">{{ page.labels.move }}</button>
          <button class="butAction" type="button" @click="libraryCall('copy', { id: page.preview.id, target: $event.target.form.target.value }).catch((cause) => { error.value = cause.message })">{{ page.labels.copy }}</button>
        </form>
      </aside>
      <section>
        <h2 class="opacitymedium">{{ page.labels.expiring }}</h2>
        <p v-for="item in page.expiring" :key="item.id">{{ item.name }} — {{ item.expires }}</p>
      </section>
      <section>
        <h2 class="opacitymedium">{{ page.labels.audit }}</h2>
        <p v-for="(row, index) in page.audit" :key="index">{{ row.at }} {{ row.actor }} {{ row.action }} {{ row.name }}</p>
      </section>
      <section>
        <h2 class="opacitymedium">{{ page.labels.requests }}</h2>
        <p v-for="item in page.requests" :key="item.id">{{ item.user }} — {{ item.name }}
          <button type="button" @click="libraryCall('decide', { id: item.id, accept: true }).catch((cause) => { error.value = cause.message })">{{ page.labels.approve }}</button>
          <button type="button" @click="libraryCall('decide', { id: item.id, accept: false }).catch((cause) => { error.value = cause.message })">{{ page.labels.refuse }}</button>
        </p>
      </section>
      <details class="library-admin">
        <summary>{{ page.labels.settings }}</summary>
        <form @submit.prevent="libraryCall('settings', { mode: $event.target.mode.value, defaultSource: $event.target.defaultSource.value, trashDays: $event.target.trashDays.value, autoFolder: $event.target.autoFolder.checked, order: $event.target.order.value, nextcloudUrl: $event.target.nextcloudUrl.value, gdriveUrl: $event.target.gdriveUrl.value, onedriveUrl: $event.target.onedriveUrl.value, s3Url: $event.target.s3Url.value, s3Bucket: $event.target.s3Bucket.value, minioUrl: $event.target.minioUrl.value, minioBucket: $event.target.minioBucket.value, ftpHost: $event.target.ftpHost.value, ftpPort: $event.target.ftpPort.value, smbHost: $event.target.smbHost.value, smbPort: $event.target.smbPort.value, collaboraUrl: $event.target.collaboraUrl.value, stirlingUrl: $event.target.stirlingUrl.value, docusealUrl: $event.target.docusealUrl.value, yousignUrl: $event.target.yousignUrl.value }).catch((cause) => { error.value = cause.message })">
          <label>{{ page.labels.mode }}
            <select name="mode" class="flat"><option value="permissive">{{ page.labels.permissive }}</option><option value="restrictive">{{ page.labels.restrictive }}</option></select>
          </label>
          <label>{{ page.labels.defaultSource }} <input name="defaultSource" class="flat" :value="page.settings.defaultSource" /></label>
          <label>{{ page.labels.trashDays }} <input name="trashDays" class="flat" :value="page.settings.trashDays" /></label>
          <label>{{ page.labels.order }} <input name="order" class="flat" :value="page.settings.order" /></label>
          <label><input name="autoFolder" type="checkbox" :checked="page.settings.autoFolder" /> {{ page.labels.auto }}</label>
          <p>{{ page.labels.entity }} : {{ page.diagnostics.entity }}</p>
          <p v-for="item in page.connectors" :key="item.code">{{ item.label }} — {{ item.status }}</p>
          <input name="nextcloudUrl" class="flat" :placeholder="'Nextcloud'" :value="connector('nextcloud').url" />
          <input name="gdriveUrl" class="flat" placeholder="Google Drive" :value="connector('gdrive').url" />
          <input name="onedriveUrl" class="flat" placeholder="OneDrive" :value="connector('onedrive').url" />
          <input name="s3Url" class="flat" placeholder="S3" :value="connector('s3').url" />
          <input name="s3Bucket" class="flat" placeholder="bucket" :value="connector('s3').bucket" />
          <input name="minioUrl" class="flat" placeholder="MinIO" :value="connector('minio').url" />
          <input name="minioBucket" class="flat" placeholder="bucket" :value="connector('minio').bucket" />
          <input name="ftpHost" class="flat" placeholder="FTP" :value="connector('ftp').host" />
          <input name="ftpPort" class="flat" :value="connector('ftp').port" />
          <input name="smbHost" class="flat" placeholder="SMB" :value="connector('smb').host" />
          <input name="smbPort" class="flat" :value="connector('smb').port" />
          <input name="collaboraUrl" class="flat" placeholder="Collabora" :value="connector('collabora').url" />
          <input name="stirlingUrl" class="flat" placeholder="Stirling-PDF" :value="connector('stirling').url" />
          <input name="docusealUrl" class="flat" placeholder="DocuSeal" :value="connector('docuseal').url" />
          <input name="yousignUrl" class="flat" placeholder="Yousign" :value="connector('yousign').url" />
          <div class="tabsAction"><button class="butAction" type="submit">{{ page.labels.save }}</button></div>
        </form>
        <p v-for="item in page.connectors" :key="item.code + '-test'">
          <button type="button" @click="libraryCall('test', { connector: item.code }).catch((cause) => { error.value = cause.message })">{{ page.labels.test }} {{ item.label }}</button>
          <span class="opacitymedium">{{ item.detail }}</span>
        </p>
        <form class="library-tools" @submit.prevent="libraryCall('template', { name: $event.target.name.value, paths: $event.target.paths.value }).catch((cause) => { error.value = cause.message })">
          <input name="name" class="flat" :placeholder="page.labels.templates" required />
          <textarea name="paths" class="flat" rows="3"></textarea>
          <button class="butAction" type="submit">{{ page.labels.save }}</button>
        </form>
        <form class="library-tools" @submit.prevent="libraryCall('apply', { name: $event.target.name.value }).catch((cause) => { error.value = cause.message })">
          <select name="name" class="flat"><option v-for="item in page.templates" :key="item.name" :value="item.name">{{ item.name }}</option></select>
          <button class="butAction" type="submit">{{ page.labels.apply }}</button>
        </form>
        <form class="library-tools" @submit.prevent="libraryCall('shortcut', { name: $event.target.name.value, url: $event.target.url.value }).catch((cause) => { error.value = cause.message })">
          <input name="name" class="flat" :placeholder="page.labels.shortcut" required />
          <input name="url" class="flat" placeholder="https://" />
          <button class="butAction" type="submit">{{ page.labels.shortcut }}</button>
        </form>
        <form class="library-tools" @submit.prevent="libraryCall('acl', { id: page.preview && page.preview.id, holder: $event.target.holder.value, holderId: $event.target.holderId.value, grant: $event.target.grant.value }).catch((cause) => { error.value = cause.message })">
          <select name="holder" class="flat"><option value="user">{{ page.labels.user }}</option><option value="group">{{ page.labels.group }}</option></select>
          <input name="holderId" class="flat" placeholder="id" />
          <select name="grant" class="flat"><option value="read">{{ page.labels.read }}</option><option value="write">{{ page.labels.write }}</option><option value="none">{{ page.labels.none }}</option></select>
          <button class="butAction" type="submit">{{ page.labels.grant }}</button>
        </form>
        <p>{{ page.labels.diagnostics }} : {{ page.diagnostics.files }} / {{ page.labels.trash }} {{ page.diagnostics.trash }}</p>
        <button class="butAction" type="button" @click="libraryCall('purge', {}).catch((cause) => { error.value = cause.message })">{{ page.labels.purge }}</button>
        <button class="butAction" type="button" @click="libraryBackup().catch((cause) => { error.value = cause.message })">{{ page.labels.backup }}</button>
        <button v-if="page.folder" class="butAction" type="button" @click="libraryCall('request', { id: page.folder, message: '' }).catch((cause) => { error.value = cause.message })">{{ page.labels.request }}</button>
      </details>
    </div>

    <form v-else-if="page.kind === 'vat'" @submit.prevent="save().catch((cause) => { error.value = cause.message })">
      <table class="border">
        <tbody>
          <tr>
            <td class="titlefield"><label for="fromRate">{{ nav.chrome['setup.vatFrom'] }}</label></td>
            <td><input id="fromRate" v-model="values.fromRate" class="flat" /></td>
          </tr>
          <tr>
            <td class="titlefield"><label for="toRate">{{ nav.chrome['setup.vatTo'] }}</label></td>
            <td><input id="toRate" v-model="values.toRate" class="flat" /></td>
          </tr>
        </tbody>
      </table>
      <div class="tabsAction"><button class="butAction" type="submit">{{ nav.chrome['action.apply'] }}</button></div>
    </form>
  </div>
</template>
