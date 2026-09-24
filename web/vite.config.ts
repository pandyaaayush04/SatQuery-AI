import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  worker: { format: 'es' }, // satellite.js's wasm worker uses top-level await, which the default iife worker format can't bundle
  server: {
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
