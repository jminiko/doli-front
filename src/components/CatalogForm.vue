<script setup>
import { computed, inject, ref } from 'vue'
import RichEditor from './RichEditor.vue'

const props = defineProps({
  form: { type: Object, required: true },
  values: { type: Object, required: true }
})
const emit = defineEmits(['save', 'remove'])
const nav = inject('nav')
const tagInput = ref('')

const product = computed(() => props.form.screen.layout === 'product')
const creating = computed(() => !props.form.row?.id)

function t(key, fallback) {
  const text = nav.value?.chrome?.[key]
  return text && text !== key ? text : fallback
}

function field(name) {
  return props.form.screen.fields.find((item) => item.name === name) || { label: '', options: [] }
}

function label(name, fallback) {
  const text = field(name).label
  if (text && !String(text).startsWith('field.')) return text
  return fallback
}

function options(name, fallback) {
  const remote = field(name).options || []
  const known = new Map(fallback.map((item) => [item.value, item.label]))
  if (!remote.length) return fallback
  return remote.map((item) => {
    const raw = item.label
    const translated = raw && raw !== item.value && !String(raw).startsWith('status.')
    return { value: item.value, label: translated ? raw : (known.get(String(item.value)) || raw) }
  })
}

const saleOptions = computed(() => options('saleStatus', [
  { value: 'onsale', label: t('service.onsale', 'En vente') },
  { value: 'offsale', label: t('service.offsale', 'Hors vente') }
]))
const buyOptions = computed(() => options('buyStatus', [
  { value: 'onbuy', label: t('service.onbuy', 'En achat') },
  { value: 'offbuy', label: t('service.offbuy', 'Hors achat') }
]))
const batchOptions = computed(() => options('batchMode', [
  { value: 'nobatch', label: 'Non (lot/série non utilisé)' },
  { value: 'lot', label: 'Lot' },
  { value: 'serial', label: 'Numéro de série' }
]))
const sellByOptions = computed(() => options('sellByMode', [
  { value: 'nobylimit', label: 'Aucune' },
  { value: 'sellby', label: 'DLC obligatoire' },
  { value: 'eatby', label: 'DMD/DLUO obligatoire' },
  { value: 'bothdates', label: 'DLC et DMD/DLUO' }
]))
const barcodeOptions = computed(() => options('barcodeType', [
  { value: 'nobarcode', label: 'Aucun type de code-barres activé' },
  { value: 'ean13', label: 'EAN13' },
  { value: 'isbn', label: 'ISBN' },
  { value: 'upc', label: 'UPC' },
  { value: 'qr', label: 'QR' }
]))
const natureOptions = computed(() => options('nature', [
  { value: 'finished', label: 'Produit fini' },
  { value: 'raw', label: 'Matière première' },
  { value: 'intermediate', label: 'Produit semi-fini' }
]))
const weightUnits = computed(() => options('weightUnit', [
  { value: 'kg', label: 'Kg' },
  { value: 'g', label: 'g' },
  { value: 't', label: 'T' },
  { value: 'lb', label: 'Lb' }
]))
const sizeUnits = computed(() => options('sizeUnit', [
  { value: 'm', label: 'm' },
  { value: 'dm', label: 'dm' },
  { value: 'cm', label: 'cm' },
  { value: 'mm', label: 'mm' }
]))
const surfaceUnits = computed(() => options('surfaceUnit', [
  { value: 'm2', label: 'm²' },
  { value: 'dm2', label: 'dm²' },
  { value: 'cm2', label: 'cm²' }
]))
const volumeUnits = computed(() => options('volumeUnit', [
  { value: 'm3', label: 'm³' },
  { value: 'litre', label: 'L' },
  { value: 'ml', label: 'mL' }
]))
const durationUnits = computed(() => options('durationUnit', [
  { value: 'hour', label: t('service.hour', 'Heure') },
  { value: 'day', label: t('service.day', 'Jour') },
  { value: 'week', label: t('service.week', 'Semaine') },
  { value: 'month', label: t('service.month', 'Mois') }
]))
const priceBasisOptions = [
  { value: 'ht', label: 'HT' },
  { value: 'ttc', label: 'TTC' }
]
const vatOptions = computed(() => {
  const rates = ['0', '2.1', '5.5', '10', '20']
  const current = String(props.values.vatRate ?? '')
  const list = current && !rates.includes(current) ? [current, ...rates] : rates
  return list.map((rate) => ({ value: rate, label: `${rate}%` }))
})
const countries = computed(() => {
  const list = [
    ['FR', 'France'], ['BE', 'Belgique'], ['CH', 'Suisse'], ['LU', 'Luxembourg'],
    ['DE', 'Allemagne'], ['ES', 'Espagne'], ['IT', 'Italie'], ['GB', 'Royaume-Uni'],
    ['US', 'États-Unis'], ['CA', 'Canada'], ['CN', 'Chine'], ['MA', 'Maroc'],
    ['TN', 'Tunisie'], ['SN', 'Sénégal'], ['CI', 'Côte d’Ivoire']
  ].map(([value, label]) => ({ value, label }))
  const current = String(props.values.countryOrigin || '')
  if (current && !list.some((item) => item.value === current)) list.push({ value: current, label: current })
  return list
})
const warehouses = computed(() => field('defaultWarehouse').options || [])
const accountHint = computed(() => t('product.accountHint', 'Vous devez d’abord configurer votre plan comptable'))
const accounts = computed(() => [
  ['sellAccount', t('service.sell', 'Code comptable (vente)')],
  ['sellAccountIntra', t('service.sellIntra', 'Code comptable (vente intra-communautaire)')],
  ['sellAccountExport', t('service.sellExport', 'Code comptable (vente à l’export)')],
  ['buyAccount', t('service.buy', 'Code comptable (achat)')],
  ['buyAccountIntra', t('service.buyIntra', 'Code comptable (achat intra-communautaire)')],
  ['buyAccountImport', t('service.buyImport', 'Code comptable (achat import)')]
])
const tagList = computed(() => String(props.values.tags || '').split(',').map((item) => item.trim()).filter(Boolean))

function accountOptions(name) {
  const current = String(props.values[name] || '')
  const list = [{ value: '', label: accountHint.value }]
  if (current) list.push({ value: current, label: current })
  return list
}

function addTag() {
  const text = tagInput.value.trim()
  if (!text || tagList.value.includes(text)) {
    tagInput.value = ''
    return
  }
  props.values.tags = [...tagList.value, text].join(', ')
  tagInput.value = ''
}

function openPublicUrl() {
  const url = String(props.values.publicUrl || '')
  if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener')
}
</script>

<template>
  <form class="tabBar" @submit.prevent="emit('save')">
    <table class="border tableforfield">
      <tbody>
        <tr>
          <td class="titlefield">{{ product ? t('product.ref', 'Réf. produit') : t('service.ref', 'Réf. service') }}</td>
          <td><input id="ref" v-model="values.ref" class="flat" maxlength="40" /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ label('label', t('field.label', 'Libellé')) }}</td>
          <td><input id="label" v-model="values.label" class="flat" required /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('service.sale', 'État (Vente)') }}</td>
          <td>
            <select id="saleStatus" v-model="values.saleStatus" class="flat">
              <option v-for="option in saleOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('service.buyState', 'État (Achat)') }}</td>
          <td>
            <select id="buyStatus" v-model="values.buyStatus" class="flat">
              <option v-for="option in buyOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </td>
        </tr>
        <template v-if="product">
          <tr>
            <td class="titlefield">{{ label('batchMode', 'Utiliser les numéros de lots/série') }}</td>
            <td>
              <select id="batchMode" v-model="values.batchMode" class="flat">
                <option v-for="option in batchOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </td>
          </tr>
          <tr>
            <td class="titlefield">{{ label('sellByMode', 'DLC ou DMD/DLUO obligatoire') }}</td>
            <td>
              <select id="sellByMode" v-model="values.sellByMode" class="flat">
                <option v-for="option in sellByOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </td>
          </tr>
          <tr>
            <td class="titlefield">{{ label('barcodeType', 'Type de code-barres') }}</td>
            <td>
              <select id="barcodeType" v-model="values.barcodeType" class="flat">
                <option v-for="option in barcodeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </td>
          </tr>
          <tr>
            <td class="titlefield">{{ label('barcode', 'Valeur du code-barres') }}</td>
            <td class="service-inline">
              <i class="bi bi-upc" aria-hidden="true"></i>
              <input id="barcode" v-model="values.barcode" class="flat" maxlength="128" />
            </td>
          </tr>
        </template>
        <tr>
          <td class="titlefield">{{ label('description', t('field.description', 'Description')) }}</td>
          <td><RichEditor v-model="values.description" compact /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('service.publicUrl', 'URL publique') }}</td>
          <td class="service-inline">
            <input id="publicUrl" v-model="values.publicUrl" class="flat" />
            <button class="catalog-plus" type="button" @click="openPublicUrl">↗</button>
          </td>
        </tr>
        <tr v-if="product">
          <td class="titlefield">{{ label('defaultWarehouse', 'Entrepôt par défaut') }}</td>
          <td class="service-inline">
            <i class="bi bi-box" aria-hidden="true"></i>
            <select id="defaultWarehouse" v-model="values.defaultWarehouse" class="flat">
              <option value=""></option>
              <option v-for="option in warehouses" :key="option.value" :value="String(option.value)">{{ option.label }}</option>
            </select>
            <router-link class="catalog-plus" to="/screens/warehouses/new" title="Nouvel entrepôt">+</router-link>
          </td>
        </tr>
        <tr v-if="product">
          <td class="titlefield">{{ label('stockAlert', 'Limite stock pour alerte') }}</td>
          <td><input id="stockAlert" v-model="values.stockAlert" class="flat service-short" type="number" min="0" step="0.01" /></td>
        </tr>
        <tr v-if="product">
          <td class="titlefield">{{ label('stockOptimal', 'Stock désiré optimal') }}</td>
          <td><input id="stockOptimal" v-model="values.stockOptimal" class="flat service-short" type="number" min="0" step="0.01" /></td>
        </tr>
        <tr v-if="product">
          <td class="titlefield">{{ t('product.nature', 'Nature de produit') }}</td>
          <td>
            <select id="nature" v-model="values.nature" class="flat">
              <option value=""></option>
              <option v-for="option in natureOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </td>
        </tr>
        <tr v-if="product">
          <td class="titlefield">{{ label('weight', 'Poids') }}</td>
          <td class="service-inline">
            <i class="bi bi-speedometer2" aria-hidden="true"></i>
            <input id="weight" v-model="values.weight" class="flat service-short" type="number" min="0" step="0.001" />
            <select id="weightUnit" v-model="values.weightUnit" class="flat">
              <option v-for="option in weightUnits" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </td>
        </tr>
        <tr v-if="product">
          <td class="titlefield">{{ t('field.sizeLine', 'Longueur x Largeur x Hauteur') }}</td>
          <td class="service-inline">
            <i class="bi bi-rulers" aria-hidden="true"></i>
            <input id="length" v-model="values.length" class="flat service-short" type="number" min="0" step="0.001" :aria-label="label('length', 'Longueur')" />
            <span>x</span>
            <input id="width" v-model="values.width" class="flat service-short" type="number" min="0" step="0.001" :aria-label="label('width', 'Largeur')" />
            <span>x</span>
            <input id="height" v-model="values.height" class="flat service-short" type="number" min="0" step="0.001" :aria-label="label('height', 'Hauteur')" />
            <select id="sizeUnit" v-model="values.sizeUnit" class="flat">
              <option v-for="option in sizeUnits" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </td>
        </tr>
        <tr v-if="product">
          <td class="titlefield">{{ label('surface', 'Surface') }}</td>
          <td class="service-inline">
            <input id="surface" v-model="values.surface" class="flat service-short" type="number" min="0" step="0.001" />
            <select id="surfaceUnit" v-model="values.surfaceUnit" class="flat">
              <option v-for="option in surfaceUnits" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </td>
        </tr>
        <tr v-if="product">
          <td class="titlefield">{{ label('volume', 'Volume') }}</td>
          <td class="service-inline">
            <input id="volume" v-model="values.volume" class="flat service-short" type="number" min="0" step="0.001" />
            <select id="volumeUnit" v-model="values.volumeUnit" class="flat">
              <option v-for="option in volumeUnits" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </td>
        </tr>
        <tr v-if="product">
          <td class="titlefield">{{ label('customsCode', 'Nomenclature douanière') }}</td>
          <td><input id="customsCode" v-model="values.customsCode" class="flat" maxlength="32" /></td>
        </tr>
        <tr v-if="product">
          <td class="titlefield">{{ label('countryOrigin', 'Pays d’origine') }}</td>
          <td>
            <select id="countryOrigin" v-model="values.countryOrigin" class="flat">
              <option value=""></option>
              <option v-for="option in countries" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </td>
        </tr>
        <tr v-if="product">
          <td class="titlefield">{{ label('stateOrigin', 'État/province d’origine') }}</td>
          <td><input id="stateOrigin" v-model="values.stateOrigin" class="flat" maxlength="80" /></td>
        </tr>
        <tr v-if="!product">
          <td class="titlefield">{{ t('service.duration', 'Durée') }}</td>
          <td class="service-inline">
            <input id="durationValue" v-model="values.durationValue" class="flat service-short" type="number" min="0" step="1" />
            <select id="durationUnit" v-model="values.durationUnit" class="flat">
              <option v-for="option in durationUnits" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <label><input v-model="values.dateRangeRequired" type="checkbox" /> {{ t('service.dateRange', 'Plage de date obligatoire') }}</label>
          </td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('service.privateNote', 'Note (non visible sur les factures, propals...)') }}</td>
          <td><textarea id="privateNote" v-model="values.privateNote" class="flat" rows="4"></textarea></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('service.tags', 'Tags/catégories') }}</td>
          <td>
            <div class="service-inline">
              <input v-model="tagInput" class="flat" @keydown.enter.prevent="addTag" />
              <button class="catalog-plus" type="button" @click="addTag">+</button>
            </div>
            <div v-if="tagList.length" class="tag-list">
              <span v-for="tag in tagList" :key="tag" class="tag-chip">{{ tag }}</span>
            </div>
          </td>
        </tr>
        <tr>
          <td colspan="2"><hr class="service-rule" /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('service.price', 'Prix de vente') }}</td>
          <td class="service-inline">
            <input id="priceHt" v-model="values.priceHt" class="flat service-short" type="number" min="0" step="0.01" />
            <select id="priceBasis" v-model="values.priceBasis" class="flat">
              <option v-for="option in priceBasisOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('service.priceMin', 'Prix de vente min.') }}</td>
          <td><input id="priceMin" v-model="values.priceMin" class="flat service-short" type="number" min="0" step="0.01" /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ t('service.vat', 'Taux TVA') }}</td>
          <td>
            <select id="vatRate" v-model="values.vatRate" class="flat">
              <option v-for="option in vatOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </td>
        </tr>
        <tr v-for="[name, caption] in accounts" :key="name">
          <td class="titlefield">{{ caption }}</td>
          <td>
            <select :id="name" v-model="values[name]" class="flat">
              <option v-for="option in accountOptions(name)" :key="option.value || 'hint'" :value="option.value">{{ option.label }}</option>
            </select>
          </td>
        </tr>
      </tbody>
    </table>
    <div class="tabsAction catalog-actions">
      <button class="butAction" type="submit">{{ creating ? t('product.create', 'Créer') : t('action.save', 'Enregistrer') }}</button>
      <router-link class="butActionDelete" :to="`/screens/${form.screen.id}`">{{ t('action.cancel', 'Annuler') }}</router-link>
      <button v-if="form.row.id" class="butActionDelete" type="button" @click="emit('remove')">{{ t('action.delete', 'Supprimer') }}</button>
    </div>
  </form>
</template>
