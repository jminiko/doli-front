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

function fields(form) {
  const body = {}
  for (const [name, value] of new FormData(form).entries()) body[name] = value
  return body
}

async function call(verb, body) {
  error.value = ''
  const result = await api(`/api/plugins/webmail/${verb}`, { method: 'POST', locale: locale.value, body })
  const query = {}
  if (result.section) query.section = result.section
  if (result.row) query.row = result.row
  await router.replace({ path: route.path, query })
  emit('update', result.kind ? result : await api(`/api/system/webmail?${new URLSearchParams(query)}`, { locale: locale.value }))
}

function submit(verb, event) {
  const form = event.target?.form || event.target
  call(verb, fields(form)).catch((cause) => { error.value = cause.message })
}
</script>

<template>
  <div class="mailbox-desk">
    <nav class="mailbox-tabs">
      <router-link v-for="tab in page.tabs" :key="tab.section" :class="{ on: tab.current }" :to="{ path: route.path, query: { section: tab.section } }">{{ tab.label }}</router-link>
    </nav>
    <p v-if="page.notice" class="mailbox-note">{{ page.notice }}</p>
    <p v-if="page.section === 'setup'" class="opacitymedium">{{ page.hint }}</p>

    <form v-if="page.section === 'setup'" class="mailbox-form" @submit.prevent="submit('save', $event)">
      <h2>{{ page.labels.imap }}</h2>
      <label>{{ page.labels.host }} <input class="flat" name="imapHost" :value="page.account.imapHost" required /></label>
      <label>{{ page.labels.port }} <input class="flat" name="imapPort" type="number" min="1" max="65535" :value="page.account.imapPort" required /></label>
      <label>{{ page.labels.security }}
        <select class="flat" name="imapSecurity">
          <option v-for="item in page.security" :key="item.value" :value="item.value" :selected="item.value === page.account.imapSecurity">{{ item.label }}</option>
        </select>
      </label>
      <label>{{ page.labels.user }} <input class="flat" name="imapUser" :value="page.account.imapUser" required /></label>
      <label>{{ page.labels.password }} <input class="flat" name="imapPassword" type="password" autocomplete="new-password" /></label>
      <p v-if="page.account.imapReady" class="opacitymedium">{{ page.labels.passwordReady }}. {{ page.labels.passwordKeep }}</p>

      <h2>{{ page.labels.smtp }}</h2>
      <label>{{ page.labels.host }} <input class="flat" name="smtpHost" :value="page.account.smtpHost" required /></label>
      <label>{{ page.labels.port }} <input class="flat" name="smtpPort" type="number" min="1" max="65535" :value="page.account.smtpPort" required /></label>
      <label>{{ page.labels.security }}
        <select class="flat" name="smtpSecurity">
          <option v-for="item in page.security" :key="`smtp-${item.value}`" :value="item.value" :selected="item.value === page.account.smtpSecurity">{{ item.label }}</option>
        </select>
      </label>
      <label>{{ page.labels.user }} <input class="flat" name="smtpUser" :value="page.account.smtpUser" required /></label>
      <label>{{ page.labels.password }} <input class="flat" name="smtpPassword" type="password" autocomplete="new-password" /></label>
      <p v-if="page.account.smtpReady" class="opacitymedium">{{ page.labels.passwordReady }}. {{ page.labels.passwordKeep }}</p>
      <label>{{ page.labels.fromAddress }} <input class="flat" name="fromAddress" type="email" :value="page.account.fromAddress" required /></label>
      <div class="tabsAction">
        <button class="butAction" type="submit">{{ page.labels.save }}</button>
        <button class="butAction" type="button" @click="submit('check', $event)">{{ page.labels.check }}</button>
      </div>
    </form>

    <form v-else-if="page.section === 'compose'" class="mailbox-form" @submit.prevent="submit('send', $event)">
      <input type="hidden" name="row" :value="page.draft.row || ''" />
      <label>{{ page.labels.to }} <input class="flat" name="to" type="text" :value="page.draft.to" required /></label>
      <label>{{ page.labels.cc }} <input class="flat" name="cc" type="text" :value="page.draft.cc" /></label>
      <label>{{ page.labels.subject }} <input class="flat" name="subject" type="text" :value="page.draft.subject" /></label>
      <label>{{ page.labels.body }} <textarea class="flat" name="body" rows="12">{{ page.draft.body }}</textarea></label>
      <div class="tabsAction">
        <button class="butAction" type="submit">{{ page.labels.send }}</button>
        <button class="butAction" type="button" @click="submit('draft', $event)">{{ page.labels.keep }}</button>
      </div>
    </form>

    <article v-else-if="page.section === 'read' && page.message" class="mailbox-read">
      <h2>{{ page.message.subject || page.labels.empty }}</h2>
      <p>{{ page.labels.from }} : {{ page.message.from }}</p>
      <p>{{ page.labels.to }} : {{ page.message.to }}</p>
      <p v-if="page.message.cc">{{ page.labels.cc }} : {{ page.message.cc }}</p>
      <p>{{ page.labels.date }} : {{ page.message.date }}</p>
      <div class="mailbox-body">{{ page.message.body }}</div>
      <form class="tabsAction" @submit.prevent="submit('drop', $event)">
        <input type="hidden" name="row" :value="page.message.id" />
        <input type="hidden" name="folder" :value="page.message.folder" />
        <button class="butActionDelete" type="submit">{{ page.labels.drop }}</button>
      </form>
    </article>

    <section v-else>
      <form v-if="page.section === 'inbox'" class="tabsAction" @submit.prevent="submit('fetch', $event)">
        <button class="butAction" type="submit">{{ page.labels.fetch }}</button>
      </form>
      <p v-if="!page.messages.length" class="opacitymedium">{{ page.labels.empty }}</p>
      <table v-else class="tagtable liste">
        <thead>
          <tr class="liste_titre">
            <th>{{ page.labels.date }}</th>
            <th>{{ page.section === 'sent' || page.section === 'drafts' ? page.labels.to : page.labels.from }}</th>
            <th>{{ page.labels.subject }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="message in page.messages" :key="message.id" class="oddeven">
            <td>{{ message.date }}</td>
            <td>{{ page.section === 'sent' || page.section === 'drafts' ? message.to : message.from }}</td>
            <td :class="{ 'mailbox-unread': message.unread }">
              <router-link :to="{ path: route.path, query: { section: 'read', row: message.id } }">{{ message.subject || page.labels.empty }}</router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
