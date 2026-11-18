<script setup>
import { computed, inject, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../api'
import { href } from '../nav'
import FileLibrary from './FileLibrary.vue'
import ImmoDesk from './ImmoDesk.vue'
import AtsDesk from './AtsDesk.vue'
import MailboxDesk from './MailboxDesk.vue'
import WebsiteStudio from './WebsiteStudio.vue'
import RichEditor from '../components/RichEditor.vue'
import SearchableSelect from '../components/SearchableSelect.vue'

const route = useRoute()
const locale = inject('locale')
const nav = inject('nav')
const error = inject('error')
const reloadNav = inject('reloadNav')
const page = ref(null)
const values = reactive({})
const payload = ref('')
const notice = ref('')
const datasetId = ref('')
const separator = ref(';')
const report = ref(null)
const chosen = computed(() => (page.value?.datasets || []).find((item) => item.id === datasetId.value) || page.value?.datasets?.[0])

async function load() {
  error.value = ''
  notice.value = ''
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(route.query)) {
    if (value != null && value !== '') query.set(key, Array.isArray(value) ? value[0] : value)
  }
  const suffix = query.toString() ? `?${query}` : ''
  page.value = await api(`/api/system/${route.params.id}${suffix}`, { locale: locale.value })
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
  if (page.value.kind === 'exchange') {
    const ids = (page.value.datasets || []).map((item) => item.id)
    datasetId.value = ids.includes(datasetId.value) ? datasetId.value : (ids[0] || '')
    report.value = page.value.report || report.value
  }
  if (page.value.kind === 'menus') {
    for (const group of page.value.groups || []) {
      for (const entry of group.entries) {
        values[`hide_${entry.id}`] = !!entry.hidden
      }
    }
  }
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

function wizardEndpoint() {
  return page.value?.direction === 'import' ? '/api/exchange/import-wizard' : '/api/exchange/wizard'
}

async function wizard(op, extra = {}) {
  try {
    const query = new URLSearchParams({ op, lang: locale.value })
    for (const [key, value] of Object.entries(extra)) {
      if (value != null && value !== '') query.set(key, value)
    }
    const response = await fetch(`${wizardEndpoint()}?${query}`, { credentials: 'include' })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || response.statusText)
    page.value = body
    report.value = body.report || null
  } catch (cause) {
    error.value = cause.message
  }
}

async function wizardPost(event) {
  try {
    const data = Object.fromEntries(new FormData(event.target).entries())
    const op = data.op || 'filter'
    delete data.op
    const response = await fetch(`${wizardEndpoint()}?op=${encodeURIComponent(op)}&lang=${encodeURIComponent(locale.value)}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || response.statusText)
    page.value = body
    report.value = body.report || null
  } catch (cause) {
    error.value = cause.message
  }
}

async function uploadImport(event) {
  const data = new FormData(event.target)
  data.set('wizard', '1')
  const response = await fetch(`/api/exchange/import?lang=${encodeURIComponent(locale.value)}`, {
    method: 'POST',
    credentials: 'include',
    body: data
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || response.statusText)
  page.value = body
  report.value = body.report || null
}

function downloadExchange(model) {
  const query = new URLSearchParams({
    dataset: datasetId.value,
    separator: separator.value,
    lang: locale.value
  })
  if (model) query.set('model', '1')
  window.location.assign(`/api/exchange/export?${query}`)
}

onMounted(() => load().catch((cause) => { error.value = cause.message }))
watch(() => route.fullPath, () => load().catch((cause) => { error.value = cause.message }))
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
    <iframe v-if="page.kind === 'frame' && page.url" class="external-frame" :src="page.url" :title="page.title" sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-same-origin"></iframe>

    <div v-if="page.kind === 'stats'" class="div-table-responsive">
      <p class="opacitymedium">{{ page.total }}<span v-if="page.amount != null"> · {{ page.amountLabel }} {{ page.amount }}</span></p>
      <table class="tagtable liste">
        <tbody>
          <tr v-for="slice in page.slices" :key="slice.code || 'all'">
            <td>{{ slice.label }}</td>
            <td class="right">{{ slice.count }}</td>
            <td v-if="slice.amount != null" class="right">{{ slice.amount }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else-if="page.kind === 'summary'" class="box-grid">
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
              <RichEditor v-if="field.type === 'area' && /description/i.test(field.name)" v-model="values[field.name]" compact />
              <textarea v-else-if="field.type === 'area'" :id="'field-' + field.name" v-model="values[field.name]" class="flat" rows="3"></textarea>
              <input v-else-if="field.type === 'bool'" :id="'field-' + field.name" v-model="values[field.name]" class="flat" type="checkbox" />
              <SearchableSelect v-else-if="field.type === 'choice'" :id="'field-' + field.name" v-model="values[field.name]" :options="field.options || []" :placeholder="''" />
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

    <div v-else-if="page.kind === 'exchange'">
      <p v-if="report" class="opacitymedium">
        {{ page.labels.created }} {{ report.created }} · {{ page.labels.updated }} {{ report.updated }} · {{ page.labels.skipped }} {{ report.skipped }}
      </p>
      <ul v-if="report?.errors?.length">
        <li v-for="item in report.errors" :key="`${item.line}-${item.message}`">{{ item.line }} — {{ item.message }}</li>
      </ul>
      <div v-if="page.wizard && page.direction === 'import'">
        <div class="tabs">
          <a v-for="number in page.reached" :key="number" :class="['tab', { tabactive: page.step === number }]" href="#" @click.prevent="wizard('goto', { step: number })">{{ number }}</a>
        </div>
        <p class="opacitymedium">{{ page.hint }}</p>
        <table v-if="page.dataset" class="border">
          <tbody>
            <tr><td class="titlefield">{{ page.labels.module }}</td><td>{{ page.dataset.module }}</td></tr>
            <tr><td class="titlefield">{{ page.labels.dataset }}</td><td>{{ page.dataset.label }}</td></tr>
          </tbody>
        </table>
        <table v-if="page.step === 1" class="tagtable liste">
          <tbody>
            <tr class="liste_titre"><th>{{ page.labels.module }}</th><th>{{ page.labels.dataset }}</th></tr>
            <tr v-for="set in page.datasets" :key="set.id" class="oddeven">
              <td>{{ set.module }}</td>
              <td><a href="#" @click.prevent="wizard('dataset', { dataset: set.id })">{{ set.label }}</a></td>
            </tr>
          </tbody>
        </table>
        <form v-else-if="page.step === 2" @submit.prevent="uploadImport($event).catch((cause) => { error.value = cause.message })">
          <input type="hidden" name="wizard" value="1">
          <table class="border">
            <tbody>
              <tr>
                <td class="titlefield"><label for="separator">{{ page.labels.separator }}</label></td>
                <td>
                  <select id="separator" class="flat" name="separator">
                    <option v-for="item in page.separators" :key="item.value" :value="item.value" :selected="item.value === page.separator">{{ item.label }}</option>
                  </select>
                </td>
              </tr>
              <tr>
                <td class="titlefield"><label for="charset">{{ page.labels.charset }}</label></td>
                <td>
                  <select id="charset" class="flat" name="charset">
                    <option v-for="item in page.charsets" :key="item.value" :value="item.value" :selected="item.value === page.charset">{{ item.label }}</option>
                  </select>
                </td>
              </tr>
              <tr>
                <td class="titlefield"><label for="file">{{ page.labels.file }}</label></td>
                <td><input id="file" name="file" type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" required></td>
              </tr>
            </tbody>
          </table>
          <div class="tabsAction"><button class="butAction" type="submit">{{ page.labels.send }}</button></div>
        </form>
        <form v-else-if="page.step === 3" @submit.prevent="wizardPost($event)">
          <input type="hidden" name="op" value="run">
          <table class="tagtable liste">
            <tbody>
              <tr class="liste_titre"><th>{{ page.labels.column }}</th><th>{{ page.labels.sample }}</th><th>{{ page.labels.target }}</th></tr>
              <tr v-for="column in page.columns" :key="column.index" class="oddeven">
                <td>{{ column.header }}</td>
                <td>{{ column.sample }}</td>
                <td>
                  <select class="flat" :name="'map_' + column.index">
                    <option value="">{{ page.labels.skip }}</option>
                    <optgroup v-for="group in page.groups" :key="group.label" :label="group.label">
                      <option v-for="field in group.fields" :key="field.code" :value="field.code" :selected="field.code === column.target">{{ field.label }}</option>
                    </optgroup>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
          <p><label><input type="checkbox" name="simulate" value="1"> {{ page.labels.simulate }}</label></p>
          <div class="tabsAction"><button class="butAction" type="submit">{{ page.labels.launch }}</button></div>
        </form>
      </div>
      <div v-else-if="page.wizard">
        <div class="tabs">
          <a v-for="number in page.reached" :key="number" :class="['tab', { tabactive: page.step === number }]" href="#" @click.prevent="wizard('goto', { step: number })">{{ number }}</a>
        </div>
        <table v-if="page.dataset" class="border">
          <tbody>
            <tr><td class="titlefield">{{ page.labels.module }}</td><td>{{ page.dataset.module }}</td></tr>
            <tr><td class="titlefield">{{ page.labels.dataset }}</td><td>{{ page.dataset.label }}</td></tr>
            <tr v-if="page.step > 2"><td class="titlefield">{{ page.labels.fields }}</td><td>{{ page.summary.fields }}</td></tr>
            <tr v-if="page.step > 3"><td class="titlefield">{{ page.labels.filtered }}</td><td>{{ page.summary.filtered }}</td></tr>
          </tbody>
        </table>
        <table v-if="page.step === 1" class="tagtable liste">
          <tbody>
            <tr class="liste_titre"><th>{{ page.labels.module }}</th><th>{{ page.labels.dataset }}</th></tr>
            <tr v-for="set in page.datasets" :key="set.id" class="oddeven">
              <td>{{ set.module }}</td>
              <td><a href="#" @click.prevent="wizard('dataset', { dataset: set.id })">{{ set.label }}</a></td>
            </tr>
          </tbody>
        </table>
        <div v-else-if="page.step === 2">
          <form @submit.prevent="wizard('apply', { profile: $event.target.profile.value })">
            <label>{{ page.labels.profile }}</label>
            <select class="flat" name="profile">
              <option value="">{{ page.labels.noProfile }}</option>
              <option v-for="profile in page.profiles" :key="profile.id" :value="profile.id">{{ profile.name }}</option>
            </select>
            <button class="butAction" type="submit">{{ page.labels.apply }}</button>
          </form>
          <p>
            <a class="butAction" href="#" @click.prevent="wizard('all')">{{ page.labels.all }}</a>
            <a class="butAction" href="#" @click.prevent="wizard('none')">{{ page.labels.none }}</a>
          </p>
          <table class="tagtable liste">
            <tbody>
              <tr class="liste_titre"><th>{{ page.labels.module }}</th><th>{{ page.labels.available }}</th><th>{{ page.labels.chosen }}</th></tr>
              <tr v-for="field in page.available" :key="'a-' + field.code" class="oddeven">
                <td>{{ field.group }}</td>
                <td><a href="#" @click.prevent="wizard('toggle', { field: field.code })">{{ field.label }}</a></td>
                <td></td>
              </tr>
              <tr v-for="field in page.selected" :key="'s-' + field.code" class="oddeven">
                <td>{{ field.group }}</td>
                <td></td>
                <td><a href="#" @click.prevent="wizard('toggle', { field: field.code })">{{ field.position }}. {{ field.label }}</a></td>
              </tr>
            </tbody>
          </table>
          <div v-if="page.selected.length" class="tabsAction"><a class="butAction" href="#" @click.prevent="wizard('next')">{{ page.labels.next }}</a></div>
        </div>
        <form v-else-if="page.step === 3" @submit.prevent="wizardPost($event)">
          <input type="hidden" name="op" value="filter">
          <table class="tagtable liste">
            <tbody>
              <tr class="liste_titre"><th>{{ page.labels.module }}</th><th>{{ page.labels.available }}</th><th>{{ page.labels.filtered }}</th></tr>
              <tr v-for="field in page.filters" :key="field.code" class="oddeven">
                <td>{{ field.group }}</td>
                <td>{{ field.label }}</td>
                <td><input class="flat" :name="'filter_' + field.code" :value="field.value"></td>
              </tr>
            </tbody>
          </table>
          <div class="tabsAction"><button class="butAction" type="submit">{{ page.labels.next }}</button></div>
        </form>
        <div v-else-if="page.step === 4">
          <table class="tagtable liste">
            <tbody>
              <tr class="liste_titre"><th>{{ page.labels.chosen }}</th><th>{{ page.labels.position }}</th><th>{{ page.labels.order }}</th></tr>
              <tr v-for="field in page.selected" :key="field.code" class="oddeven">
                <td>{{ field.group }} — {{ field.label }}</td>
                <td>{{ field.position }}</td>
                <td>
                  <a href="#" @click.prevent="wizard('move', { field: field.code, dir: 'up' })">{{ page.labels.up }}</a>
                  <a href="#" @click.prevent="wizard('move', { field: field.code, dir: 'down' })">{{ page.labels.down }}</a>
                </td>
              </tr>
            </tbody>
          </table>
          <form @submit.prevent="wizardPost($event)">
            <input type="hidden" name="op" value="saveProfile">
            <table class="border">
              <tbody>
                <tr><td class="titlefield">{{ page.labels.name }}</td><td><input class="flat" name="name" :value="page.profileName"></td></tr>
                <tr>
                  <td class="titlefield">{{ page.labels.visibility }}</td>
                  <td>
                    <select class="flat" name="visibility">
                      <option value="private">{{ page.labels.private_ }}</option>
                      <option value="public">{{ page.labels.public_ }}</option>
                    </select>
                  </td>
                </tr>
              </tbody>
            </table>
            <button class="butAction" type="submit">{{ page.labels.save }}</button>
          </form>
          <div class="tabsAction"><a class="butAction" href="#" @click.prevent="wizard('next')">{{ page.labels.next }}</a></div>
        </div>
        <div v-else>
          <form @submit.prevent="wizard('build', { format: $event.target.format.value })">
            <label>{{ page.labels.format }}</label>
            <select class="flat" name="format">
              <option v-for="format in page.formats" :key="format.id" :value="format.id">{{ format.label }}</option>
            </select>
            <button class="butAction" type="submit">{{ page.labels.generate }}</button>
          </form>
          <table class="tagtable liste">
            <tbody>
              <tr class="liste_titre"><th>{{ page.labels.files }}</th><th></th></tr>
              <tr v-for="file in page.files" :key="file.name" class="oddeven">
                <td><a :href="`/api/exchange/file?dataset=${page.dataset.id}&name=${encodeURIComponent(file.name)}`">{{ file.name }}</a> {{ file.size }} {{ file.date }}</td>
                <td><a href="#" @click.prevent="wizard('remove', { name: file.name })">{{ page.labels.remove }}</a></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <form v-else-if="page.direction === 'export'" @submit.prevent="downloadExchange(false)">
        <table class="border">
          <tbody>
            <tr>
              <td class="titlefield"><label for="dataset">{{ page.labels.dataset }}</label></td>
              <td>
                <select id="dataset" v-model="datasetId" class="flat" name="dataset">
                  <option v-for="set in page.datasets" :key="set.id" :value="set.id">{{ set.label }}</option>
                </select>
              </td>
            </tr>
            <tr>
              <td class="titlefield"><label for="separator">{{ page.labels.separator }}</label></td>
              <td>
                <select id="separator" v-model="separator" class="flat" name="separator">
                  <option v-for="item in page.separators" :key="item.value" :value="item.value">{{ item.label }}</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
        <div class="tabsAction">
          <button class="butAction" type="submit">{{ page.labels.download }}</button>
          <button class="butAction" type="button" @click="downloadExchange(true)">{{ page.labels.model }}</button>
        </div>
      </form>
      <p v-if="chosen?.fields" class="opacitymedium">{{ page.labels.columns }} : {{ chosen.fields.map((field) => field.name).join(', ') }}</p>
    </div>

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

    <FileLibrary v-else-if="page.kind === 'library'" :page="page" @update="page = $event" />
    <WebsiteStudio v-else-if="page.kind === 'studio'" :page="page" @update="page = $event" />
    <ImmoDesk v-else-if="page.kind === 'ledger'" :page="page" @update="page = $event" />
    <AtsDesk v-else-if="page.kind === 'ats'" :page="page" @update="page = $event" />
    <MailboxDesk v-else-if="page.kind === 'mailbox'" :page="page" @update="page = $event" />
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
