<script setup>
import { inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '../api'

const props = defineProps({ page: { type: Object, required: true } })
const emit = defineEmits(['update'])
const route = useRoute()
const router = useRouter()
const locale = inject('locale')
const error = inject('error')

function go(query) {
  router.push({ path: route.path, query })
}

async function call(verb, extra = {}) {
  error.value = ''
  const body = { section: props.page.section, ...extra }
  await api(`/api/plugins/ultimateimmo/${verb}`, { method: 'POST', locale: locale.value, body })
  const query = { section: props.page.section }
  if (verb === 'save' && extra.row) query.row = extra.row
  if (props.page.year && props.page.section === 'result') query.year = props.page.year
  await router.replace({ path: route.path, query })
  const suffix = new URLSearchParams(query).toString()
  emit('update', await api(`/api/system/ultimateimmo?${suffix}`, { locale: locale.value }))
}

function submit(event, row) {
  const body = { row: row || '' }
  for (const [name, value] of new FormData(event.target).entries()) body[name] = value
  call(event.target.dataset.verb || 'save', body).catch((cause) => { error.value = cause.message })
}
</script>

<template>
  <div class="immo-desk">
    <h2 class="opacitymedium">{{ page.heading }}</h2>
    <p v-for="line in page.notes || []" :key="line" class="opacitymedium">{{ line }}</p>

    <form v-if="page.years" class="immo-year" @change="go({ section: 'result', year: $event.target.value })">
      <label>{{ page.yearLabel }} <select :value="page.year"><option v-for="year in page.years" :key="year" :value="year">{{ year }}</option></select></label>
    </form>

    <section v-for="block in page.blocks || []" :key="block.title">
      <h3 v-if="block.title">{{ block.title }}</h3>
      <table v-if="block.headers" class="liste">
        <thead>
          <tr class="liste_titre">
            <th v-for="header in block.headers" :key="header">{{ header }}</th>
            <th v-if="block.actions"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!(block.rows || []).length"><td :colspan="block.headers.length + (block.actions ? 1 : 0)" class="opacitymedium">{{ page.empty }}</td></tr>
          <tr v-for="row in block.rows" :key="row.row || row.cells.join('|')">
            <td v-for="(cell, index) in row.cells" :key="index">
              <button v-if="index === 0 && (row.row || row.section)" type="button" class="classfortooltip" @click="go(row.row ? { section: row.section || page.section, row: row.row } : { section: row.section })">{{ cell }}</button>
              <span v-else>{{ cell }}</span>
            </td>
            <td v-if="block.actions">
              <button v-for="action in block.actions" :key="action.verb" type="button" @click="call(action.verb, { row: row.row }).catch((cause) => { error.value = cause.message })">{{ action.label }}</button>
            </td>
          </tr>
        </tbody>
      </table>

      <form v-if="block.form" class="immo-form" data-verb="save" @submit.prevent="submit($event, block.form.row)">
        <input type="hidden" name="section" :value="block.form.section || page.section" />
        <table class="border">
          <tbody>
            <tr v-for="field in block.form.fields" :key="field.name">
              <td class="titlefield">{{ field.label }}</td>
              <td>
                <textarea v-if="field.type === 'text'" :name="field.name" class="flat" rows="3" :disabled="block.form.locked">{{ field.value }}</textarea>
                <select v-else-if="field.options" :name="field.name" class="flat" :disabled="block.form.locked">
                  <option v-if="!field.required" value=""></option>
                  <option v-for="option in field.options" :key="option.value" :value="option.value" :selected="option.value === field.value">{{ option.label }}</option>
                </select>
                <input v-else :name="field.name" class="flat" :type="field.input || 'text'" :step="field.step" :value="field.value" :required="field.required" :disabled="block.form.locked" />
              </td>
            </tr>
          </tbody>
        </table>
        <div class="tabsAction">
          <button v-if="!block.form.locked" class="butAction" type="submit">{{ page.save }}</button>
          <button v-if="block.form.row && block.form.removable" class="butActionDelete" type="button" @click="call('remove', { row: block.form.row, section: block.form.section || page.section }).catch((cause) => { error.value = cause.message })">{{ page.remove }}</button>
          <a v-if="block.form.pdf" class="butAction" :href="`/api/plugins/ultimateimmo/raw/${block.form.pdf}`" target="_blank" rel="noopener">{{ page.pdf }}</a>
        </div>
      </form>
    </section>

    <form v-if="page.action" :data-verb="page.action.verb" @submit.prevent="submit($event)">
      <table v-if="page.action.fields" class="border">
        <tbody>
          <tr v-for="field in page.action.fields" :key="field.name">
            <td class="titlefield">{{ field.label }}</td>
            <td>
              <select v-if="field.options" :name="field.name" class="flat" required>
                <option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
              <input v-else :name="field.name" class="flat" :value="field.value" />
            </td>
          </tr>
        </tbody>
      </table>
      <div class="tabsAction"><button class="butAction" type="submit">{{ page.action.label }}</button></div>
    </form>
  </div>
</template>
