<script setup>
import { inject, onMounted, ref } from 'vue'
import { api } from '../api'

const locale = inject('locale')
const error = inject('error')
const iconFor = inject('iconFor')
const dashboard = ref({ boxes: [] })

onMounted(async () => {
  try {
    dashboard.value = await api('/api/dashboard', { locale: locale.value })
  } catch (cause) {
    error.value = cause.message
  }
})
</script>

<template>
  <table class="table-fiche-title">
    <tbody>
      <tr class="toptitle">
        <td class="col-title">
          <div class="titre"><i class="bi bi-bar-chart-line"></i>{{ dashboard.company }}</div>
          <div class="opacitymedium">{{ dashboard.place || dashboard.tagline }}</div>
        </td>
      </tr>
    </tbody>
  </table>
  <div class="box-grid">
    <router-link v-for="(box, index) in dashboard.boxes" :key="box.id" class="info-box" :to="`/screens/${box.screen}`">
      <span class="info-box-icon" :class="'bg' + ((index % 6) + 1)"><i :class="['bi', iconFor(box.screen)]"></i></span>
      <span class="info-box-content">
        <span class="info-box-title">{{ box.label }}</span>
        <span class="info-box-number">{{ box.value }}</span>
      </span>
    </router-link>
  </div>
</template>
