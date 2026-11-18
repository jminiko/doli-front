<script setup>
import { computed, inject } from 'vue'
import RichEditor from './RichEditor.vue'

const props = defineProps({
  form: { type: Object, required: true },
  values: { type: Object, required: true }
})
const emit = defineEmits(['save', 'remove'])
const nav = inject('nav')

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

const statuses = computed(() => {
  const remote = field('status').options || []
  if (remote.length && remote.some((item) => item.label && item.label !== item.value)) return remote
  return [
    { value: 'open', label: 'Ouvert' },
    { value: 'closed', label: 'Clos' }
  ]
})
const parents = computed(() => {
  const self = props.form.row?.id ? String(props.form.row.id) : ''
  return (field('parent').options || []).filter((item) => String(item.value) !== self)
})
const countries = computed(() => {
  const list = [
    ['FR', 'France'], ['BE', 'Belgique'], ['CH', 'Suisse'], ['LU', 'Luxembourg'],
    ['DE', 'Allemagne'], ['ES', 'Espagne'], ['IT', 'Italie'], ['GB', 'Royaume-Uni'],
    ['US', 'États-Unis'], ['CA', 'Canada'], ['CN', 'Chine'], ['MA', 'Maroc'],
    ['TN', 'Tunisie'], ['SN', 'Sénégal'], ['CI', 'Côte d’Ivoire']
  ].map(([value, label]) => ({ value, label }))
  const current = String(props.values.country || '')
  if (current && !list.some((item) => item.value === current)) list.push({ value: current, label: current })
  return list
})
</script>

<template>
  <form class="tabBar" @submit.prevent="emit('save')">
    <table class="border tableforfield">
      <tbody>
        <tr>
          <td class="titlefield">{{ label('ref', t('field.ref', 'Réf. entrepôt')) }}</td>
          <td><input id="ref" v-model="values.ref" class="flat" maxlength="40" /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ label('label', t('field.label', 'Libellé')) }}</td>
          <td><input id="label" v-model="values.label" class="flat" required /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ label('description', t('field.description', 'Description')) }}</td>
          <td><RichEditor v-model="values.description" compact /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ label('status', t('field.status', 'Statut')) }}</td>
          <td>
            <select id="status" v-model="values.status" class="flat">
              <option v-for="option in statuses" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </td>
        </tr>
        <tr>
          <td class="titlefield">{{ label('parent', 'Entrepôt parent') }}</td>
          <td class="service-inline">
            <select id="parent" v-model="values.parent" class="flat">
              <option value=""></option>
              <option v-for="option in parents" :key="option.value" :value="String(option.value)">{{ option.label }}</option>
            </select>
            <router-link class="catalog-plus" to="/screens/warehouses/new" title="Nouvel entrepôt">+</router-link>
          </td>
        </tr>
        <tr>
          <td class="titlefield">{{ label('location', 'Lieu') }}</td>
          <td><input id="location" v-model="values.location" class="flat" maxlength="180" /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ label('address', 'Adresse') }}</td>
          <td><textarea id="address" v-model="values.address" class="flat" rows="2" maxlength="255"></textarea></td>
        </tr>
        <tr>
          <td class="titlefield">{{ label('zip', 'Code postal') }}</td>
          <td><input id="zip" v-model="values.zip" class="flat service-short" maxlength="20" /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ label('town', 'Ville') }}</td>
          <td><input id="town" v-model="values.town" class="flat" maxlength="120" /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ label('country', 'Pays') }}</td>
          <td>
            <select id="country" v-model="values.country" class="flat">
              <option value=""></option>
              <option v-for="option in countries" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </td>
        </tr>
        <tr>
          <td class="titlefield">{{ label('phone', 'Téléphone') }}</td>
          <td><input id="phone" v-model="values.phone" class="flat" type="tel" maxlength="40" /></td>
        </tr>
        <tr>
          <td class="titlefield">{{ label('fax', 'Fax') }}</td>
          <td><input id="fax" v-model="values.fax" class="flat" type="tel" maxlength="40" /></td>
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
