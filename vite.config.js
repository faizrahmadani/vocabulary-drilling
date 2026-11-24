import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // The auth API is a separate project (NodeRed-On-Vercel) on port 1880.
  // Locally the proxy keeps /api same-origin so no CORS/Secure flags are needed.
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:1880', changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:1880', changeOrigin: true },
    },
  },
})
