<script setup>
import { computed, ref } from 'vue'
import { ProgressIndicator, ProgressRoot } from 'reka-ui'
import { api, assertUploadSize } from '../api'

const props = defineProps({
  locale: { type: String, default: 'fr' },
  nav: { type: Object, default: () => ({}) },
  folder: { type: [String, Number], default: '' },
  source: { type: String, default: '' },
  section: { type: String, default: 'explorer' },
  ownerType: { type: String, default: '' },
  ownerId: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  compact: { type: Boolean, default: false }
})

const emit = defineEmits(['done', 'fail'])
const input = ref(null)
const chosen = ref([])
const percent = ref(0)
const active = ref(false)
const current = ref('')
const visible = computed(() => chosen.value.length > 0)

function formatSize(size) {
  if (size < 1024) return `${size} o`
  if (size < 1048576) return `${(size / 1024).toFixed(1)} Ko`
  return `${(size / 1048576).toFixed(1)} Mo`
}

function pick(event) {
  chosen.value = Array.from(event.target.files || [])
  percent.value = 0
  current.value = ''
}

function send(data, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/plugins/filemanager/upload?lang=${encodeURIComponent(props.locale)}`)
    xhr.withCredentials = true
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total)
    }
    xhr.onload = () => {
      let payload = {}
      try {
        payload = JSON.parse(xhr.responseText || '{}')
      } catch (ignored) {
        payload = {}
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload)
      else reject(new Error(payload.error || xhr.statusText))
    }
    xhr.onerror = () => reject(new Error('upload'))
    xhr.send(data)
  })
}

async function start(event) {
  event.preventDefault()
  if (active.value || !chosen.value.length) return
  try {
    chosen.value.forEach((file) => assertUploadSize(file, props.nav))
    active.value = true
    percent.value = 0
    const reserved = await api('/api/plugins/filemanager/reserve', {
      locale: props.locale,
      method: 'POST',
      body: {
        folder: props.folder || '',
        source: props.source || '',
        section: props.section || 'explorer',
        ownerType: props.ownerType || '',
        ownerId: props.ownerId || '',
        files: chosen.value.map((file) => ({ name: file.name, size: file.size }))
      }
    })
    const total = Number(reserved.total) || chosen.value.reduce((sum, file) => sum + file.size, 0)
    let received = 0
    let last = null
    for (let index = 0; index < chosen.value.length; index += 1) {
      const file = chosen.value[index]
      current.value = file.name
      const data = new FormData()
      data.set('ticket', reserved.ticket)
      data.set('index', String(index))
      data.set('upload', file)
      data.set('folder', String(props.folder || ''))
      data.set('source', props.source || '')
      data.set('section', props.section || 'explorer')
      if (props.ownerType) data.set('ownerType', props.ownerType)
      if (props.ownerId !== '' && props.ownerId != null) data.set('ownerId', String(props.ownerId))
      last = await send(data, (loaded, length) => {
        const currentBytes = length ? (loaded / length) * file.size : 0
        percent.value = total ? Math.max(0, Math.min(100, Math.round(((received + currentBytes) / total) * 100))) : 0
      })
      received += file.size
      percent.value = total ? Math.max(0, Math.min(100, Math.round((received / total) * 100))) : 100
    }
    chosen.value = []
    current.value = ''
    percent.value = 100
    if (input.value) input.value.value = ''
    emit('done', last)
  } catch (cause) {
    emit('fail', cause.message || 'upload')
  } finally {
    active.value = false
  }
}
</script>

<template>
  <form class="fm-upload" :class="{ 'fm-form': !compact }" @submit.prevent="start">
    <input ref="input" name="upload" type="file" multiple required :disabled="active" @change="pick" />
    <button :class="{ butAction: !compact }" type="submit" :disabled="active || !chosen.length">
      <i v-if="compact" class="bi bi-cloud-upload"></i>
      <template v-else>{{ label }}</template>
    </button>
    <div v-if="visible" class="fm-upload-panel">
      <ul class="fm-upload-files">
        <li v-for="file in chosen" :key="`${file.name}-${file.size}`" :class="{ on: file.name === current }">
          <span>{{ file.name }}</span>
          <span>{{ formatSize(file.size) }}</span>
        </li>
      </ul>
      <ProgressRoot class="fm-upload-track" :model-value="percent" :max="100" :get-value-label="(value) => `${value ?? 0} %`">
        <ProgressIndicator class="fm-upload-indicator" :style="{ transform: `translateX(-${100 - percent}%)` }" />
      </ProgressRoot>
      <p class="fm-upload-meta">{{ percent }} %</p>
    </div>
  </form>
</template>
