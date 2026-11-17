<script setup>
import { computed, inject, ref, watch } from 'vue'
import { api } from '../api'
import SearchableSelect from './SearchableSelect.vue'

const props = defineProps({
  form: { type: Object, required: true },
  values: { type: Object, required: true }
})
const emit = defineEmits(['save', 'remove'])
const locale = inject('locale')
const nav = inject('nav')

const query = ref({ name: '', siren: '', naf: '', rna: '', zip: '', state: '' })
const openOnly = ref(false)
const headOnly = ref(false)
const moreCriteria = ref(false)
const more = ref(true)
const socials = ref(false)
const hits = ref([])
const notice = ref('')
const vatNotice = ref('')
const logo = ref(null)

function t(key) {
  return nav.value?.chrome?.[key] || key
}

function field(name) {
  return props.form.screen.fields.find((item) => item.name === name) || { label: '', options: [], readOnly: false }
}

function choices(name) {
  const list = props.form.screen.catalog?.[name] || []
  const current = props.values[name === 'partyTypes' ? 'partyType'
    : name === 'workforces' ? 'workforce'
    : name === 'legalForms' ? 'legalForm'
    : name === 'paymentTerms' ? 'paymentTerms'
    : name === 'paymentModes' ? 'paymentMode'
    : name === 'incoterms' ? 'incoterms'
    : name === 'currencies' ? 'currency'
    : name === 'sireneStatuses' ? 'sireneStatus'
    : name === 'countries' ? 'country' : '']
  if (current && !list.some((item) => item.value === current)) {
    return [...list, { value: current, label: current }]
  }
  return list
}

const parents = computed(() => {
  const self = props.form.row?.id ? String(props.form.row.id) : ''
  return (field('parent').options || []).filter((item) => item.value !== self)
})

const reps = computed({
  get: () => String(props.values.salesReps || '').split(',').filter(Boolean),
  set: (list) => { props.values.salesReps = (Array.isArray(list) ? list : []).join(',') }
})

const socialCount = computed(() => ['facebook', 'linkedin', 'instagram', 'socialX'].filter((name) => props.values[name]).length)
const statusLocked = computed(() => field('customerStatus').readOnly)
const supplierLocked = computed(() => field('supplier').readOnly)
const statusOptions = computed(() => {
  const list = field('status').options || []
  return list.length ? list : [
    { value: 'open', label: t('status.open') },
    { value: 'closed', label: t('status.closed') }
  ]
})
const logoUrl = computed(() => (props.form.row?.id && props.values.logoName)
  ? `/api/screens/${props.form.screen.id}/${props.form.row.id}/logo`
  : '')

watch(() => props.form.row?.id, () => {
  logo.value = null
  hits.value = []
  notice.value = ''
  vatNotice.value = ''
})

watch(socialCount, (count) => {
  if (count) socials.value = true
}, { immediate: true })

function onLogo(event) {
  logo.value = event.target.files?.[0] || null
}

function readLogo(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function search() {
  notice.value = ''
  hits.value = []
  const params = new URLSearchParams()
  Object.entries(query.value).forEach(([key, value]) => { if (value && (moreCriteria.value || key === 'name' || key === 'siren' || key === 'naf' || key === 'rna')) params.set(key, value) })
  if (openOnly.value) params.set('open', '1')
  if (headOnly.value) params.set('head', '1')
  try {
    const data = await api(`/api/sirene?${params}`, { locale: locale.value })
    hits.value = data.results || []
    if (!hits.value.length) notice.value = t('thirdparty.empty')
  } catch (cause) {
    notice.value = cause.message || t('thirdparty.sireneDown')
  }
}

function applyHit(hit) {
  Object.entries(hit.fields || {}).forEach(([key, value]) => {
    if (value != null && value !== '') props.values[key] = String(value)
  })
}

async function checkVat() {
  vatNotice.value = ''
  try {
    const data = await api('/api/vat/check', { locale: locale.value, method: 'POST', body: { number: props.values.vatNumber } })
    vatNotice.value = data.valid ? t('thirdparty.vatOk') : t('thirdparty.vatKo')
    if (data.name) vatNotice.value += ` — ${data.name}`
  } catch (cause) {
    vatNotice.value = cause.message || t('thirdparty.sireneDown')
  }
}

async function submit() {
  notice.value = ''
  if (!statusLocked.value) {
    const prospect = props.values.prospect === true
    const customer = props.values.customer === true
    props.values.customerStatus = prospect && customer ? 'both' : customer ? 'customer' : prospect ? 'prospect' : 'none'
  }
  if (logo.value) {
    if (logo.value.size > 2_000_000) {
      notice.value = t('thirdparty.logoSize')
      return
    }
    props.values.logoData = { name: logo.value.name, data: await readLogo(logo.value) }
  }
  emit('save')
}
</script>

<template>
  <form class="tabBar party-card" @submit.prevent="submit">
    <header v-if="form.row?.id" class="party-identity">
      <img v-if="logoUrl" class="party-identity-logo" :src="logoUrl" :alt="values.logoName || values.name" />
      <i v-else class="bi bi-building party-identity-icon"></i>
      <div>
        <h2>{{ values.name }}</h2>
        <p v-if="values.nameAlias" class="party-alias">{{ values.nameAlias }}</p>
        <p class="party-codes">
          <span v-if="values.code">{{ t('thirdparty.clientCode') }} {{ values.code }}</span>
          <span v-if="values.supplierCode">{{ t('thirdparty.supplierCode') }} {{ values.supplierCode }}</span>
        </p>
        <div class="party-badges">
          <span v-if="values.prospect" class="badge">{{ t('thirdparty.prospect') }}</span>
          <span v-if="values.customer" class="badge badge-open">{{ t('thirdparty.customer') }}</span>
          <span v-if="values.supplier" class="badge badge-active">{{ t('thirdparty.supplier') }}</span>
        </div>
      </div>
    </header>
    <section class="party-search">
      <div class="party-search-title"><i class="bi bi-search"></i> {{ t('thirdparty.searchTitle') }}</div>
      <div class="party-search-filters">
        <label><input v-model="openOnly" type="checkbox" /> {{ t('thirdparty.openOnly') }}</label>
        <label><input v-model="headOnly" type="checkbox" /> {{ t('thirdparty.headOnly') }}</label>
        <button class="party-link" type="button" @click="moreCriteria = !moreCriteria">{{ t('thirdparty.moreCriteria') }}</button>
      </div>
      <div class="party-search-grid">
        <label>{{ t('thirdparty.legalName') }}
          <input v-model="query.name" class="flat" :placeholder="t('thirdparty.exampleName')" />
        </label>
        <label>{{ t('thirdparty.sirenSiret') }}
          <input v-model="query.siren" class="flat" :placeholder="t('thirdparty.exampleSiren')" />
        </label>
        <label>{{ t('thirdparty.naf') }}
          <input v-model="query.naf" class="flat" :placeholder="t('thirdparty.exampleNaf')" />
        </label>
        <label>{{ t('thirdparty.rna') }}
          <input v-model="query.rna" class="flat" :placeholder="t('thirdparty.exampleRna')" />
        </label>
        <label v-if="moreCriteria">{{ t('thirdparty.zip') }}
          <input v-model="query.zip" class="flat" />
        </label>
        <label v-if="moreCriteria">{{ t('thirdparty.department') }}
          <input v-model="query.state" class="flat" />
        </label>
      </div>
      <button class="butAction" type="button" @click="search">{{ t('thirdparty.search') }}</button>
      <p v-if="notice" class="party-notice">{{ notice }}</p>
      <ul v-if="hits.length" class="party-hits">
        <li v-for="(hit, index) in hits" :key="index"><button type="button" @click="applyHit(hit)">{{ hit.label }}</button></li>
      </ul>
    </section>

    <table class="border party-table">
      <colgroup>
        <col class="label" />
        <col class="value" />
        <col class="label" />
        <col class="value" />
      </colgroup>
      <tbody>
        <tr>
          <td class="titlefield">{{ t('thirdparty.name') }}</td>
          <td colspan="3"><input v-model="values.name" class="flat" required maxlength="255" /></td>
        </tr>
        <tr>
          <td></td>
          <td><input v-model="values.nameAlias" class="flat" maxlength="255" :placeholder="t('thirdparty.alias')" /></td>
          <td colspan="2">
            <span class="party-roles">
              <label><input v-model="values.prospect" type="checkbox" :disabled="statusLocked" /> {{ t('thirdparty.prospect') }}</label>
              <label><input v-model="values.customer" type="checkbox" :disabled="statusLocked" /> {{ t('thirdparty.customer') }}</label>
              <label><input v-model="values.supplier" type="checkbox" :disabled="supplierLocked" /> {{ t('thirdparty.supplier') }}</label>
            </span>
          </td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.clientCode') }}</td>
          <td><input v-model="values.code" class="flat" required maxlength="32" /></td>
          <td class="titlefield">{{ t('thirdparty.supplierCode') }}</td>
          <td><input v-model="values.supplierCode" class="flat" maxlength="32" /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.address') }}</td>
          <td colspan="3"><textarea v-model="values.address" class="flat" rows="2" maxlength="255"></textarea></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.zip') }}</td>
          <td><input v-model="values.zip" class="flat" maxlength="20" /></td>
          <td class="titlefield">{{ t('thirdparty.town') }}</td>
          <td><input v-model="values.town" class="flat" maxlength="120" /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.country') }}</td>
          <td>
            <SearchableSelect v-model="values.country" :options="choices('countries')" :placeholder="t('thirdparty.country')" />
          </td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.department') }}</td>
          <td class="pair">
            <input v-model="values.state" class="flat" maxlength="80" placeholder="Département" />
            <input v-model="values.canton" class="flat" maxlength="80" placeholder="Canton" />
          </td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.phone') }}</td>
          <td><input v-model="values.phone" class="flat" type="tel" maxlength="40" /></td>
          <td class="titlefield">{{ t('thirdparty.mobile') }}</td>
          <td><input v-model="values.phoneMobile" class="flat" type="tel" maxlength="40" /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.fax') }}</td>
          <td><input v-model="values.fax" class="flat" type="tel" maxlength="40" /></td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.web') }}</td>
          <td colspan="3"><input v-model="values.url" class="flat" type="url" maxlength="255" /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.email') }}</td>
          <td><input v-model="values.email" class="flat" type="email" maxlength="180" /></td>
          <td class="titlefield">{{ t('thirdparty.noEmail') }}</td>
          <td>
            <label class="party-roles">
              <input v-model="values.noEmail" type="checkbox" />
              {{ values.noEmail ? t('action.yes') : t('action.no') }}
            </label>
          </td>
        </tr>
        <tr>
          <td colspan="4">
            <button class="party-link" type="button" @click="socials = !socials">{{ t('thirdparty.socials') }} {{ socialCount }}</button>
          </td>
        </tr>
        <tr v-if="socials">
          <td class="titlefield">{{ t('thirdparty.facebook') }}</td>
          <td><input v-model="values.facebook" class="flat" maxlength="180" /></td>
          <td class="titlefield">{{ t('thirdparty.linkedin') }}</td>
          <td><input v-model="values.linkedin" class="flat" maxlength="180" /></td>
        </tr>
        <tr v-if="socials">
          <td class="titlefield">{{ t('thirdparty.instagram') }}</td>
          <td><input v-model="values.instagram" class="flat" maxlength="180" /></td>
          <td class="titlefield">{{ t('thirdparty.socialX') }}</td>
          <td><input v-model="values.socialX" class="flat" maxlength="180" /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.id1') }}</td>
          <td><input v-model="values.siren" class="flat" maxlength="14" /></td>
          <td class="titlefield">{{ t('thirdparty.id2') }}</td>
          <td><input v-model="values.siret" class="flat" maxlength="14" /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.id3') }}</td>
          <td><input v-model="values.naf" class="flat" maxlength="16" /></td>
          <td class="titlefield">{{ t('thirdparty.id4') }}</td>
          <td><input v-model="values.rcs" class="flat" maxlength="40" /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.id5') }}</td>
          <td><input v-model="values.eori" class="flat" maxlength="20" /></td>
          <td class="titlefield">{{ t('thirdparty.id6') }}</td>
          <td><input v-model="values.rna" class="flat" maxlength="20" /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.vatSubject') }}</td>
          <td><input v-model="values.vatSubject" type="checkbox" /></td>
          <td class="titlefield">{{ t('thirdparty.vatNumber') }}</td>
          <td class="pair">
            <input v-model="values.vatNumber" class="flat" maxlength="32" />
            <button class="butAction" type="button" @click="checkVat">{{ t('thirdparty.checkVat') }}</button>
            <span v-if="vatNotice" class="party-notice">{{ vatNotice }}</span>
          </td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.euid') }}</td>
          <td colspan="3"><input v-model="values.euid" class="flat" maxlength="40" /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ field('status').label || t('field.status') }}</td>
          <td>
            <SearchableSelect v-model="values.status" :options="statusOptions" :placeholder="field('status').label || t('field.status')" />
          </td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td class="titlefield">{{ field('note').label || t('field.note') }}</td>
          <td colspan="3"><textarea v-model="values.note" class="flat" rows="3"></textarea></td>
        </tr>
        <tr>
          <td colspan="4"><button class="party-link" type="button" @click="more = !more"><i class="bi" :class="more ? 'bi-dash-lg' : 'bi-plus-lg'"></i> {{ t('thirdparty.more') }}</button></td>
        </tr>
      </tbody>
      <tbody v-show="more">
        <tr>
          <td class="titlefield">{{ t('thirdparty.partyType') }}</td>
          <td>
            <SearchableSelect v-model="values.partyType" :options="choices('partyTypes')" :placeholder="t('thirdparty.partyType')" />
          </td>
          <td class="titlefield">{{ t('thirdparty.workforce') }}</td>
          <td>
            <SearchableSelect v-model="values.workforce" :options="choices('workforces')" :placeholder="t('thirdparty.workforce')" />
          </td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.legalForm') }}</td>
          <td colspan="3">
            <SearchableSelect v-model="values.legalForm" :options="choices('legalForms')" :placeholder="t('thirdparty.legalForm')" />
          </td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.founded') }}</td>
          <td><input v-model="values.foundedOn" class="flat" type="date" /></td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.capital') }}</td>
          <td class="pair"><input v-model="values.capital" class="flat" type="number" step="0.01" min="0" /> <span>€</span></td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.paymentTerms') }}</td>
          <td>
            <SearchableSelect v-model="values.paymentTerms" :options="choices('paymentTerms')" :placeholder="t('thirdparty.paymentTerms')" />
          </td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.paymentMode') }}</td>
          <td>
            <SearchableSelect v-model="values.paymentMode" :options="choices('paymentModes')" :placeholder="t('thirdparty.paymentMode')" />
          </td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.incoterms') }}</td>
          <td>
            <SearchableSelect v-model="values.incoterms" :options="choices('incoterms')" :placeholder="t('thirdparty.incoterms')" />
          </td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.currency') }}</td>
          <td>
            <SearchableSelect v-model="values.currency" :options="choices('currencies')" :required="true" :placeholder="t('thirdparty.currency')" />
          </td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.sireneStatus') }}</td>
          <td>
            <SearchableSelect v-model="values.sireneStatus" :options="choices('sireneStatuses')" :placeholder="t('thirdparty.sireneStatus')" />
          </td>
          <td></td>
          <td></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.parent') }}</td>
          <td colspan="3">
            <SearchableSelect v-model="values.parent" :options="parents" :placeholder="t('thirdparty.parentPick')" />
          </td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.salesReps') }}</td>
          <td colspan="3">
            <SearchableSelect v-model="reps" :options="form.screen.staff || []" multiple :placeholder="t('thirdparty.salesReps')" />
          </td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('thirdparty.logo') }}</td>
          <td colspan="3">
            <img v-if="logoUrl" class="party-logo" :src="logoUrl" :alt="values.logoName" />
            <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" @change="onLogo" />
          </td>
        </tr>
      </tbody>
    </table>
    <div class="tabsAction">
      <button class="butAction" type="submit">{{ form.row.id ? t('action.save') : t('thirdparty.create') }}</button>
      <router-link v-if="form.row.id" class="butActionDelete" :to="`/screens/${form.screen.id}/${form.row.id}`">{{ t('action.cancel') }}</router-link>
      <router-link v-else class="butActionDelete" :to="`/screens/${form.screen.id}`">{{ t('action.cancel') }}</router-link>
      <button v-if="form.row.id" class="butActionDelete" type="button" @click="emit('remove')">{{ t('action.delete') }}</button>
    </div>
  </form>
</template>
