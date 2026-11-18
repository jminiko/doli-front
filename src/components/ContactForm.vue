<script setup>
import { computed, inject, ref } from 'vue'
import { useRoute } from 'vue-router'
import RichEditor from './RichEditor.vue'
import SearchableSelect from './SearchableSelect.vue'

const props = defineProps({
  form: { type: Object, required: true },
  values: { type: Object, required: true },
  editing: { type: Boolean, default: false }
})
const emit = defineEmits(['save', 'remove'])
const nav = inject('nav')
const route = useRoute()
const photo = ref(null)
const notice = ref('')

function t(key) {
  return nav.value?.chrome?.[key] || key
}

function field(name) {
  return props.form.screen.fields.find((item) => item.name === name) || { label: name, options: [] }
}

function catalog(name) {
  return props.form.screen.catalog?.[name] || []
}

function optionLabel(name, value) {
  if (value == null || value === '') return ''
  return catalog(name).find((item) => item.value === String(value))?.label || String(value)
}

function text(name) {
  const value = props.values[name]
  return value == null || value === '' ? '' : String(value)
}

function yesNo(name) {
  return props.values[name] === true || props.values[name] === 'true' ? t('action.yes') : t('action.no')
}

const backQuery = computed(() => {
  const back = String(route.query.back || '')
  if (!(back.startsWith('/screens/') || back.startsWith('/desk/'))) return {}
  const query = { back }
  if (route.query.backTab) query.backTab = String(route.query.backTab)
  return query
})
const editTo = computed(() => ({
  path: `/screens/${props.form.screen.id}/${props.form.row.id}`,
  query: { ...backQuery.value, mode: 'edit' }
}))
const viewTo = computed(() => ({
  path: `/screens/${props.form.screen.id}/${props.form.row.id}`,
  query: backQuery.value
}))
const photoUrl = computed(() => (props.form.row?.id && props.values.photoName)
  ? `/api/screens/${props.form.screen.id}/${props.form.row.id}/logo`
  : '')
const chosen = computed({
  get: () => (Array.isArray(props.values.categories) ? props.values.categories.map(String) : []),
  set: (list) => { props.values.categories = (Array.isArray(list) ? list : []).map(String) }
})

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function submit() {
  notice.value = ''
  props.values.categoriesPresent = '1'
  if (photo.value) {
    if (photo.value.size > 2_000_000) {
      notice.value = t('thirdparty.logoSize')
      return
    }
    props.values.photoData = { name: photo.value.name, data: await readFile(photo.value) }
  }
  emit('save')
}
</script>

<template>
  <div v-if="!editing" class="tabBar">
    <div class="fichecenter">
      <div class="fichehalfleft">
        <table class="border tableforfield">
          <tbody>
            <tr><td class="titlefield">ID</td><td>{{ form.row.id }}</td></tr>
            <tr><td class="titlefield">{{ field('civility').label }}</td><td>{{ optionLabel('civilities', values.civility) }}</td></tr>
            <tr><td class="titlefield">{{ field('lastname').label }}</td><td>{{ text('lastname') }}</td></tr>
            <tr><td class="titlefield">{{ field('firstname').label }}</td><td>{{ text('firstname') }}</td></tr>
            <tr>
              <td class="titlefield">{{ field('thirdParty').label }}</td>
              <td>
                <router-link v-if="values.thirdParty" :to="`/screens/thirdparties/${values.thirdParty}`">{{ form.row.labels.thirdParty || values.thirdParty }}</router-link>
              </td>
            </tr>
            <tr><td class="titlefield">{{ field('relation').label }}</td><td>{{ form.row.labels.relation || text('relation') }}</td></tr>
            <tr><td class="titlefield">{{ field('positionTitle').label }}</td><td>{{ text('positionTitle') }}</td></tr>
            <tr><td class="titlefield">{{ field('address').label }}</td><td class="contact-note">{{ text('address') }}</td></tr>
            <tr><td class="titlefield">{{ field('zip').label }}</td><td>{{ text('zip') }} {{ text('town') }}</td></tr>
            <tr><td class="titlefield">{{ field('country').label }}</td><td>{{ optionLabel('countries', values.country) }}</td></tr>
            <tr><td class="titlefield">{{ field('state').label }}</td><td>{{ text('state') }}</td></tr>
            <tr><td class="titlefield">{{ t('contact.phonePro') }}</td><td>{{ text('phone') }}</td></tr>
            <tr><td class="titlefield">{{ field('phonePerso').label }}</td><td>{{ text('phonePerso') }}</td></tr>
            <tr><td class="titlefield">{{ field('phoneMobile').label }}</td><td>{{ text('phoneMobile') }}</td></tr>
            <tr><td class="titlefield">{{ field('fax').label }}</td><td>{{ text('fax') }}</td></tr>
            <tr><td class="titlefield">{{ field('email').label }}</td><td>{{ text('email') }}</td></tr>
            <tr><td class="titlefield">{{ field('noEmail').label }}</td><td>{{ yesNo('noEmail') }}</td></tr>
            <tr><td class="titlefield">{{ field('facebook').label }}</td><td>{{ text('facebook') }}</td></tr>
            <tr><td class="titlefield">{{ field('linkedin').label }}</td><td>{{ text('linkedin') }}</td></tr>
            <tr><td class="titlefield">{{ field('instagram').label }}</td><td>{{ text('instagram') }}</td></tr>
            <tr><td class="titlefield">{{ field('socialX').label }}</td><td>{{ text('socialX') }}</td></tr>
            <tr><td class="titlefield">{{ t('contact.visibility') }}</td><td>{{ optionLabel('visibilities', values.visibility || 'shared') }}</td></tr>
            <tr><td class="titlefield">{{ field('defaultLang').label }}</td><td>{{ optionLabel('languages', values.defaultLang) }}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="fichehalfright">
        <table class="border tableforfield">
          <tbody>
            <tr><td class="titlefield">{{ field('status').label }}</td><td>{{ form.row.labels.status || text('status') }}</td></tr>
            <tr><td class="titlefield">{{ t('field.categories') }}</td><td>{{ form.row.labels.categories || '' }}</td></tr>
            <tr v-if="values.thirdParty">
              <td class="titlefield">{{ t('contact.byDefault') }}</td>
              <td>
                <div>{{ t('field.defaultProposal') }} : {{ yesNo('defaultProposal') }}</div>
                <div>{{ t('field.defaultOrder') }} : {{ yesNo('defaultOrder') }}</div>
                <div>{{ t('field.defaultContract') }} : {{ yesNo('defaultContract') }}</div>
                <div>{{ t('field.defaultInvoice') }} : {{ yesNo('defaultInvoice') }}</div>
              </td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('field.photo') }}</td>
              <td><img v-if="photoUrl" class="contact-photo" :src="photoUrl" alt="" /></td>
            </tr>
            <tr><td class="titlefield">{{ field('publicNote').label }}</td><td class="contact-note" v-html="values.publicNote"></td></tr>
            <tr><td class="titlefield">{{ field('privateNote').label }}</td><td class="contact-note" v-html="values.privateNote"></td></tr>
            <tr>
              <td class="titlefield">{{ t('contact.personal') }}</td>
              <td>{{ text('birthday') }}<template v-if="values.birthdayAlert"> · {{ t('field.birthdayAlert') }}</template></td>
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
  <form v-else class="tabBar" @submit.prevent="submit">
    <p v-if="notice" class="error">{{ notice }}</p>
    <div class="fichecenter">
      <div class="fichehalfleft">
        <table class="border tableforfield">
          <tbody>
            <tr v-if="form.row.id"><td class="titlefield">ID</td><td>{{ form.row.id }}</td></tr>
            <tr>
              <td class="titlefield">{{ field('civility').label }}</td>
              <td><SearchableSelect id="civility" v-model="values.civility" :options="catalog('civilities')" :search-threshold="12" placeholder="" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('lastname').label }}</td>
              <td><input id="lastname" v-model="values.lastname" class="flat" required maxlength="120" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('firstname').label }}</td>
              <td><input id="firstname" v-model="values.firstname" class="flat" maxlength="120" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('thirdParty').label }}</td>
              <td><SearchableSelect id="thirdParty" v-model="values.thirdParty" :options="field('thirdParty').options || []" :search-threshold="1" placeholder="" required /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('relation').label }}</td>
              <td><SearchableSelect id="relation" v-model="values.relation" :options="field('relation').options || []" :search-threshold="12" placeholder="" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('positionTitle').label }}</td>
              <td><input id="positionTitle" v-model="values.positionTitle" class="flat" maxlength="120" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('address').label }}</td>
              <td><textarea id="address" v-model="values.address" class="flat" rows="3" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('zip').label }}</td>
              <td class="pair">
                <input id="zip" v-model="values.zip" class="flat" maxlength="20" />
                <input id="town" v-model="values.town" class="flat" maxlength="120" :placeholder="field('town').label" />
              </td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('country').label }}</td>
              <td><SearchableSelect id="country" v-model="values.country" :options="catalog('countries')" :search-threshold="12" placeholder="" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('state').label }}</td>
              <td><input id="state" v-model="values.state" class="flat" maxlength="80" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('contact.phonePro') }}</td>
              <td><input id="phone" v-model="values.phone" class="flat" type="tel" maxlength="40" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('phonePerso').label }}</td>
              <td><input id="phonePerso" v-model="values.phonePerso" class="flat" type="tel" maxlength="40" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('phoneMobile').label }}</td>
              <td><input id="phoneMobile" v-model="values.phoneMobile" class="flat" type="tel" maxlength="40" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('fax').label }}</td>
              <td><input id="fax" v-model="values.fax" class="flat" type="tel" maxlength="40" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('email').label }}</td>
              <td><input id="email" v-model="values.email" class="flat" type="email" maxlength="180" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('noEmail').label }}</td>
              <td class="field-bool">
                <label><input v-model="values.noEmail" type="radio" name="noEmail" :value="true" /> {{ t('action.yes') }}</label>
                <label><input v-model="values.noEmail" type="radio" name="noEmail" :value="false" /> {{ t('action.no') }}</label>
              </td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('facebook').label }}</td>
              <td><input id="facebook" v-model="values.facebook" class="flat" maxlength="180" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('linkedin').label }}</td>
              <td><input id="linkedin" v-model="values.linkedin" class="flat" maxlength="180" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('instagram').label }}</td>
              <td><input id="instagram" v-model="values.instagram" class="flat" maxlength="180" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('socialX').label }}</td>
              <td><input id="socialX" v-model="values.socialX" class="flat" maxlength="180" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('contact.visibility') }}</td>
              <td><SearchableSelect id="visibility" v-model="values.visibility" :options="catalog('visibilities')" :search-threshold="12" placeholder="" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('defaultLang').label }}</td>
              <td><SearchableSelect id="defaultLang" v-model="values.defaultLang" :options="catalog('languages')" :search-threshold="12" placeholder="" /></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="fichehalfright">
        <table class="border tableforfield">
          <tbody>
            <tr>
              <td class="titlefield">{{ field('status').label }}</td>
              <td><SearchableSelect id="status" v-model="values.status" :options="field('status').options || []" :search-threshold="12" placeholder="" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('field.categories') }}</td>
              <td><SearchableSelect id="categories" v-model="chosen" :options="catalog('categories')" multiple :search-threshold="12" placeholder="" /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('contact.byDefault') }}</td>
              <td class="contact-checks">
                <label><input v-model="values.defaultProposal" type="checkbox" /> {{ t('field.defaultProposal') }}</label>
                <label><input v-model="values.defaultOrder" type="checkbox" /> {{ t('field.defaultOrder') }}</label>
                <label><input v-model="values.defaultContract" type="checkbox" /> {{ t('field.defaultContract') }}</label>
                <label><input v-model="values.defaultInvoice" type="checkbox" /> {{ t('field.defaultInvoice') }}</label>
              </td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('field.photo') }}</td>
              <td>
                <img v-if="photoUrl" class="contact-photo" :src="photoUrl" alt="" />
                <input class="flat" type="file" accept="image/png,image/jpeg,image/gif,image/webp" @change="photo = $event.target.files?.[0] || null" />
                <label v-if="photoUrl"><input v-model="values.photoDelete" type="checkbox" /> {{ t('contact.deletePhoto') }}</label>
              </td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('publicNote').label }}</td>
              <td><RichEditor v-model="values.publicNote" compact /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ field('privateNote').label }}</td>
              <td><RichEditor v-model="values.privateNote" compact /></td>
            </tr>
            <tr>
              <td class="titlefield">{{ t('contact.personal') }}</td>
              <td class="pair">
                <input id="birthday" v-model="values.birthday" class="flat" type="date" />
                <label><input v-model="values.birthdayAlert" type="checkbox" /> {{ t('field.birthdayAlert') }}</label>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div class="tabsAction">
      <button class="butAction" type="submit">{{ t('action.save') }}</button>
      <router-link v-if="form.row.id" class="butActionDelete" :to="viewTo">{{ t('action.cancel') }}</router-link>
      <router-link v-else class="butActionDelete" :to="`/screens/${form.screen.id}`">{{ t('action.cancel') }}</router-link>
    </div>
  </form>
</template>
