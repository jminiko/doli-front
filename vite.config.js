import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_URL || 'http://127.0.0.1:8080'
  const shareUrl = env.VITE_SHARE_URL || apiUrl
  const siteUrl = env.VITE_SITE_URL || apiUrl
  return {
    plugins: [vue()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy: {
        '/api': apiUrl,
        '/share': shareUrl,
        '/site': siteUrl
      }
    }
  }
})
