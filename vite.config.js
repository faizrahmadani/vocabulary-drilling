import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      // Same-origin from the browser's point of view: no CORS in local dev.
      '/api': { target: 'http://127.0.0.1:3001', changeOrigin: true },
    },
  },
})
