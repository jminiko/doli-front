<script setup>
import { computed, inject } from 'vue'

const props = defineProps({
  form: { type: Object, required: true }
})
const emit = defineEmits(['remove'])
const nav = inject('nav')
const locale = inject('locale')

function t(key) {
  return nav.value?.chrome?.[key] || key
}

function fieldLabel(name) {
  return props.form.screen.fields?.find((item) => item.name === name)?.label || t(`field.${name}`)
}

const values = computed(() => props.form.row?.values || {})
const labels = computed(() => props.form.row?.labels || {})

function text(name) {
  const value = values.value[name]
  return value == null || value === '' ? '' : String(value)
}

function catalog(name, value) {
  if (value == null || value === '') return ''
  const list = props.form.screen.catalog?.[name] || []
  return list.find((item) => item.value === String(value))?.label || String(value)
}

function yesNo(name) {
  if (labels.value[name]) return labels.value[name]
  return values.value[name] === true || values.value[name] === 'true' ? t('action.yes') : t('action.no')
}

function money(name) {
  const raw = text(name)
  if (!raw) return ''
  const value = Number(raw)
  if (!Number.isFinite(value)) return raw
  const amount = value.toLocaleString(locale.value || 'fr', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const currency = text('currency')
  return currency ? `${amount} ${currency}` : amount
}

function linkOf(value) {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (/^www\./i.test(value)) return `https://${value}`
  return ''
}

const logoUrl = computed(() => (props.form.row?.id && values.value.logoName)
  ? `/api/screens/${props.form.screen.id}/${props.form.row.id}/logo`
  : '')

const role = computed(() => values.value.customerStatus || 'none')
const prospect = computed(() => role.value === 'prospect' || role.value === 'both')
const customer = computed(() => role.value === 'customer' || role.value === 'both')
const supplier = computed(() => values.value.supplier === true || values.value.supplier === 'true')

const address = computed(() => {
  const lines = []
  if (text('address')) lines.push(text('address'))
  const place = [text('zip'), text('town')].filter(Boolean).join(' ')
  if (place) lines.push(place)
  const country = catalog('countries', values.value.country)
  if (country) lines.push(country)
  const area = [text('state'), text('canton')].filter(Boolean).join(' / ')
  if (area) lines.push(area)
  return lines.join('\n')
})

const reps = computed(() => {
  const staff = props.form.screen.staff || []
  return text('salesReps').split(',').filter(Boolean).map((id) => staff.find((item) => item.value === id)?.label || id)
})

const socials = computed(() => [
  ['facebook', 'thirdparty.facebook', 'bi-facebook'],
  ['linkedin', 'thirdparty.linkedin', 'bi-linkedin'],
  ['instagram', 'thirdparty.instagram', 'bi-instagram'],
  ['socialX', 'thirdparty.socialX', 'bi-twitter-x']
].flatMap(([name, key, icon]) => {
  const value = text(name)
  if (!value) return []
  return [{ label: t(key), icon, value, href: linkOf(value) }]
}))

const ids = [
  ['siren', 'thirdparty.id1'],
  ['siret', 'thirdparty.id2'],
  ['naf', 'thirdparty.id3'],
  ['rcs', 'thirdparty.id4'],
  ['eori', 'thirdparty.id5'],
  ['rna', 'thirdparty.id6']
]

const statusKey = computed(() => String(values.value.status || '').toLowerCase())
const statusClass = computed(() => (statusKey.value ? `badge badge-${statusKey.value}` : 'badge'))
const editTo = computed(() => ({ path: `/screens/${props.form.screen.id}/${props.form.row.id}`, query: { mode: 'edit' } }))
</script>

<template>
  <div class="party-card">
    <header class="party-identity party-banner">
      <div class="party-banner-main">
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
            <span v-if="prospect" class="badge">{{ t('thirdparty.prospect') }}</span>
            <span v-if="customer" class="badge badge-open">{{ t('thirdparty.customer') }}</span>
            <span v-if="supplier" class="badge badge-active">{{ t('thirdparty.supplier') }}</span>
          </div>
        </div>
      </div>
      <div class="banner-right">
        <span :class="statusClass">{{ labels.status || values.status }}</span>
      </div>
    </header>

    <div class="fichecenter">
      <div class="fichehalfleft">
        <table class="border tableforfield">
          <tbody>
            <tr>
              <td class="titlefield">{{ t('thirdparty.address') }}</td>
              <td class="party-address">{{ address }}</td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.phone') }}</td>
              <td><a v-if="text('phone')" :href="`tel:${text('phone')}`">{{ text('phone') }}</a></td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.mobile') }}</td>
              <td><a v-if="text('phoneMobile')" :href="`tel:${text('phoneMobile')}`">{{ text('phoneMobile') }}</a></td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.fax') }}</td>
              <td>{{ text('fax') }}</td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.email') }}</td>
              <td><a v-if="text('email')" :href="`mailto:${text('email')}`">{{ text('email') }}</a></td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.web') }}</td>
              <td>
                <a v-if="linkOf(text('url'))" :href="linkOf(text('url'))" target="_blank" rel="noopener">{{ text('url') }}</a>
                <template v-else>{{ text('url') }}</template>
              </td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.noEmail') }}</td>
              <td>{{ yesNo('noEmail') }}</td>
            </tr>
            <tr v-for="item in socials" :key="item.label">
              <td class="titlefield">{{ item.label }}</td>
              <td>
                <a v-if="item.href" class="party-socials" :href="item.href" target="_blank" rel="noopener"><i :class="['bi', item.icon]"></i>{{ item.value }}</a>
                <span v-else class="party-socials"><i :class="['bi', item.icon]"></i>{{ item.value }}</span>
              </td>
            </tr>
            <tr v-for="item in ids" :key="item[0]">
              <td class="titlefield">{{ t(item[1]) }}</td>
              <td>{{ text(item[0]) }}</td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.vatSubject') }}</td>
              <td>{{ yesNo('vatSubject') }}</td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.vatNumber') }}</td>
              <td>{{ text('vatNumber') }}</td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.euid') }}</td>
              <td>{{ text('euid') }}</td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.parent') }}</td>
              <td>
                <router-link v-if="values.parent" :to="`/screens/thirdparties/${values.parent}`">{{ labels.parent || values.parent }}</router-link>
              </td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.salesReps') }}</td>
              <td>{{ reps.join(', ') }}</td>
            </tr>
            <tr>
              <td class="titlefield">{{ fieldLabel('note') }}</td>
              <td class="party-address">{{ text('note') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="fichehalfright">
        <table class="border tableforfield">
          <tbody>
            <tr>
              <td class="titlefield">{{ t('thirdparty.clientCode') }}</td>
              <td>{{ text('code') }}</td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.supplierCode') }}</td>
              <td>{{ text('supplierCode') }}</td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.partyType') }}</td>
              <td>{{ catalog('partyTypes', values.partyType) }}</td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.workforce') }}</td>
              <td>{{ catalog('workforces', values.workforce) }}</td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.legalForm') }}</td>
              <td>{{ catalog('legalForms', values.legalForm) }}</td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.founded') }}</td>
              <td>{{ labels.foundedOn || text('foundedOn') }}</td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.capital') }}</td>
              <td>{{ money('capital') }}</td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.paymentTerms') }}</td>
              <td>{{ catalog('paymentTerms', values.paymentTerms) }}</td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.paymentMode') }}</td>
              <td>{{ catalog('paymentModes', values.paymentMode) }}</td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.incoterms') }}</td>
              <td>{{ catalog('incoterms', values.incoterms) }}</td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.currency') }}</td>
              <td>{{ catalog('currencies', values.currency) }}</td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('thirdparty.sireneStatus') }}</td>
              <td>{{ catalog('sireneStatuses', values.sireneStatus) }}</td>
            </tr>
            <tr>
              <td class="titlefield">{{ fieldLabel('status') }}</td>
              <td>{{ labels.status || text('status') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="tabsAction">
      <router-link class="butAction" :to="editTo">{{ t('action.modify') }}</router-link>
      <button class="butActionDelete" type="button" @click="emit('remove')">{{ t('action.delete') }}</button>
    </div>
  </div>
</template>
