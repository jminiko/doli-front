<template>
  <div class="rich-editor-wrap" :class="{ 'is-compact': compact }">
    <div ref="host" class="rich-editor"></div>
    <textarea v-if="name" ref="sink" class="rich-editor-sink" :name="name" hidden></textarea>
    <div v-if="loading" class="rich-editor-loading">{{ placeholder }}</div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Chargement de l\u2019\u00e9diteur\u2026' },
  compact: { type: Boolean, default: false },
  name: { type: String, default: '' }
})
const emit = defineEmits(['update:modelValue'])

const host = ref(null)
const sink = ref(null)
const loading = ref(true)
let editor = null
let ready = false
let destroyed = false

const config = {
  toolbar: [
    'heading', '|', 'bold', 'italic', 'underline', 'strikethrough', '|',
    'link', 'bulletedList', 'numberedList', '|',
    'alignment', 'outdent', 'indent', '|',
    'blockQuote', 'insertTable', 'imageUpload', 'mediaEmbed', '|',
    'undo', 'redo'
  ],
  image: {
    toolbar: ['imageTextAlternative', '|', 'imageStyle:alignLeft', 'imageStyle:full', 'imageStyle:alignRight']
  },
  table: {
    contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells']
  }
}

async function init(el) {
  if (!el || editor || destroyed) return
  try {
    const module = await import('@ckeditor/ckeditor5-build-classic')
    if (destroyed) return
    const ClassicEditor = module.default
    editor = await ClassicEditor.create(el, {
      ...config,
      initialData: props.modelValue || ''
    })
    if (destroyed) {
      editor.destroy()
      editor = null
      return
    }
    ready = true
    loading.value = false
    publish(editor.getData())
    editor.model.document.on('change:data', () => publish(editor.getData()))
  } catch (cause) {
    loading.value = false
    console.error('CKEditor init failed', cause)
  }
}

watch(host, (el) => {
  if (el) init(el)
}, { immediate: true })

function publish(data) {
  if (sink.value) sink.value.value = data || ''
  if (data !== props.modelValue) emit('update:modelValue', data)
}

watch(() => props.modelValue, (value) => {
  if (sink.value && sink.value.value !== (value || '')) sink.value.value = value || ''
  if (!ready || !editor) return
  const current = editor.getData()
  if (value !== current) {
    editor.setData(value || '')
  }
})

onBeforeUnmount(() => {
  destroyed = true
  if (editor) {
    editor.destroy()
    editor = null
  }
})
</script>
