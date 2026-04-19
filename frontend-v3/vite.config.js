import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: '/',
  plugins: [vue()],
  resolve: {
    alias: { '@': path.join(__dirname, 'src') },
  },
  build: {
    outDir: '../frontend-v3-dist',
    emptyOutDir: true,
  },
  server: {
    port: 5175,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
