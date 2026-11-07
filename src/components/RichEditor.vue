<template>
  <div class="rich-editor-wrap">
    <div ref="host" class="rich-editor"></div>
    <div v-if="loading" class="rich-editor-loading">{{ placeholder }}</div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Chargement de l\u2019\u00e9diteur\u2026' }
})
const emit = defineEmits(['update:modelValue'])

const host = ref(null)
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
    editor.model.document.on('change:data', () => {
      const data = editor.getData()
      if (data !== props.modelValue) {
        emit('update:modelValue', data)
      }
    })
  } catch (cause) {
    loading.value = false
    console.error('CKEditor init failed', cause)
  }
}

watch(host, (el) => {
  if (el) init(el)
}, { immediate: true })

watch(() => props.modelValue, (value) => {
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
