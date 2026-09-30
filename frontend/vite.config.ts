import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://backend:8000',
        changeOrigin: true,
      },
      '/sanctum': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://backend:8000',
        changeOrigin: true,
      },
      '/storage': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
})
