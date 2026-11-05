import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Версия продукта для фронта (issue #96): приходит build-arg-ом из deploy.bat
 * (APP_VERSION/APP_COMMIT), локально — из корневого package.json.
 */
function appVersion() {
  if (process.env.APP_VERSION) return String(process.env.APP_VERSION).trim()
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'))
    return String(pkg.version || '0.0.0')
  } catch (_) {
    return '0.0.0'
  }
}

export default defineConfig({
  base: '/',
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
    __APP_COMMIT__: JSON.stringify(String(process.env.APP_COMMIT || '').trim()),
  },

  resolve: {
    alias: {
      '@': path.join(__dirname, 'src'),
    },
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

