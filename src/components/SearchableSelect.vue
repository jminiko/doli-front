<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: [String, Array, Number], default: '' },
  options: { type: Array, default: () => [] },
  multiple: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  emptyLabel: { type: String, default: '' },
  // only switch to searchable popup when options count >= threshold
  searchThreshold: { type: Number, default: 1 },
  id: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue', 'change', 'blur'])

const root = ref(null)
const query = ref('')
const open = ref(false)
const highlighted = ref(-1)
const searchInput = ref(null)
const listbox = ref(null)

const isSearchable = computed(() => (props.options?.length || 0) >= props.searchThreshold)

const optionList = computed(() => (props.options || []).map((option) => {
  if (option == null) return { value: '', label: '' }
  if (typeof option === 'string' || typeof option === 'number') return { value: String(option), label: String(option) }
  return {
    value: String(option.value),
    label: option.label == null ? String(option.value) : String(option.label)
  }
}))

const normalizedValue = computed(() => {
  if (props.multiple) {
    if (Array.isArray(props.modelValue)) return props.modelValue.map(String)
    return props.modelValue == null || props.modelValue === '' ? [] : [String(props.modelValue)]
  }
  return props.modelValue == null ? '' : String(props.modelValue)
})

const selectedLabels = computed(() => {
  const map = new Map(optionList.value.map((option) => [option.value, option.label]))
  if (props.multiple) {
    return normalizedValue.value.map((value) => map.get(value) ?? value)
  }
  const value = normalizedValue.value
  return value === '' ? '' : (map.get(value) ?? value)
})

const filtered = computed(() => {
  const needle = query.value.trim().toLowerCase()
  if (!needle) return optionList.value
  return optionList.value.filter((option) =>
    option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle)
  )
})

function isSelected(value) {
  if (props.multiple) return normalizedValue.value.includes(value)
  return normalizedValue.value === value
}

function commitSingle(value) {
  emit('update:modelValue', value)
  emit('change', value)
  close()
}

function toggleMultiple(value) {
  const current = Array.isArray(props.modelValue) ? [...props.modelValue.map(String)] : []
  const index = current.indexOf(value)
  if (index === -1) current.push(value)
  else current.splice(index, 1)
  emit('update:modelValue', current)
  emit('change', current)
}

function pick(option) {
  if (props.disabled) return
  if (props.multiple) toggleMultiple(option.value)
  else commitSingle(option.value)
}

function clearSelection() {
  if (props.disabled) return
  const next = props.multiple ? [] : ''
  emit('update:modelValue', next)
  emit('change', next)
}

function openPanel() {
  if (props.disabled || open.value) return
  open.value = true
  query.value = ''
  highlighted.value = -1
  nextTick(() => {
    if (isSearchable.value) searchInput.value?.focus()
    scrollActiveIntoView()
  })
}

function close() {
  if (!open.value) return
  open.value = false
  query.value = ''
  highlighted.value = -1
  emit('blur')
}

function togglePanel() {
  if (open.value) close()
  else openPanel()
}

function onKeydown(event) {
  if (props.disabled) return
  const list = filtered.value
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (!open.value) openPanel()
      else if (list.length) highlighted.value = (highlighted.value + 1) % list.length
      scrollActiveIntoView()
      break
    case 'ArrowUp':
      event.preventDefault()
      if (!open.value) openPanel()
      else if (list.length) highlighted.value = (highlighted.value - 1 + list.length) % list.length
      scrollActiveIntoView()
      break
    case 'Home':
      if (open.value && list.length) { event.preventDefault(); highlighted.value = 0; scrollActiveIntoView() }
      break
    case 'End':
      if (open.value && list.length) { event.preventDefault(); highlighted.value = list.length - 1; scrollActiveIntoView() }
      break
    case 'Enter':
      if (open.value && list[highlighted.value]) {
        event.preventDefault()
        pick(list[highlighted.value])
      }
      break
    case 'Escape':
      if (open.value) { event.preventDefault(); close() }
      break
    case 'Tab':
      if (open.value) close()
      break
    default:
      if (!open.value && /^[a-zA-Z0-9]$/.test(event.key)) {
        openPanel()
        nextTick(() => { searchInput.value?.focus() })
      }
  }
}

function scrollActiveIntoView() {
  nextTick(() => {
    const list = listbox.value
    if (!list) return
    const item = list.querySelector('[data-idx="' + highlighted.value + '"]')
    if (item && typeof item.scrollIntoView === 'function') {
      item.scrollIntoView({ block: 'nearest' })
    }
  })
}

function onClickOutside(event) {
  if (root.value && !root.value.contains(event.target)) close()
}

watch(open, (on) => {
  if (on) document.addEventListener('mousedown', onClickOutside)
  else document.removeEventListener('mousedown', onClickOutside)
})

onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<template>
  <div ref="root" class="searchable-select" :class="{ open, disabled, multiple }">
    <!-- Native fallback for small lists -->
    <select
      v-if="!isSearchable"
      :id="id"
      class="flat"
      :multiple="multiple"
      :required="required"
      :disabled="disabled"
      :value="normalizedValue"
      @change="$emit('update:modelValue', multiple ? Array.from($event.target.selectedOptions).map((o) => o.value) : $event.target.value)"
      @blur="$emit('blur')"
    >
      <option v-if="!multiple" value="">{{ placeholder || emptyLabel || '' }}</option>
      <option v-for="option in optionList" :key="option.value" :value="option.value">{{ option.label }}</option>
    </select>

    <!-- Searchable combobox -->
    <div v-else class="ss-combo" :aria-expanded="open" aria-haspopup="listbox">
      <button
        type="button"
        class="flat ss-trigger"
        :class="{ filled: multiple ? normalizedValue.length : normalizedValue !== '' }"
        :disabled="disabled"
        :id="id"
        @click="togglePanel"
        @keydown="onKeydown"
      >
        <span v-if="multiple" class="ss-tags">
          <span v-if="!normalizedValue.length" class="ss-placeholder">{{ placeholder || emptyLabel || '' }}</span>
          <span v-for="(label, index) in selectedLabels" :key="index" class="ss-chip">
            {{ label }}
            <i class="bi bi-x-lg" @click.stop="toggleMultiple(normalizedValue[index])" aria-label="remove"></i>
          </span>
        </span>
        <template v-else>
          <span v-if="!normalizedValue" class="ss-placeholder">{{ placeholder || emptyLabel || '' }}</span>
          <span v-else>{{ selectedLabels }}</span>
        </template>
        <i class="bi bi-chevron-down ss-caret" aria-hidden="true"></i>
      </button>
      <button v-if="!multiple && normalizedValue && !required && !disabled" type="button" class="ss-clear" aria-label="clear" @click="clearSelection"><i class="bi bi-x-lg"></i></button>

      <div v-if="open" class="ss-panel" role="listbox">
        <div class="ss-search">
          <i class="bi bi-search"></i>
          <input ref="searchInput" v-model="query" type="search" autocomplete="off" :placeholder="placeholder" @keydown="onKeydown" />
        </div>
        <ul ref="listbox" class="ss-options">
          <li v-if="!filtered.length" class="ss-empty">{{ placeholder ? '' : '—' }}</li>
          <li
            v-for="(option, index) in filtered"
            :key="option.value"
            :data-idx="index"
            role="option"
            :aria-selected="isSelected(option.value)"
            :class="{ selected: isSelected(option.value), active: highlighted === index }"
            @click="pick(option)"
            @mouseenter="highlighted = index"
          >
            <span class="ss-mark"><i v-if="isSelected(option.value)" class="bi bi-check2"></i></span>
            <span class="ss-label">{{ option.label }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
