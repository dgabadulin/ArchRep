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

/**
 * Каталог фронта модуля @isar/drawio-pro (build-time, docs/modules-contract.md §7.2).
 *
 * Пока пакет не установлен — используется каталог-заглушка, чтобы `npm run build:v3`
 * не падал. Порядок: env ISAR_DRAWIO_PRO_DIR → node_modules/@isar/drawio-pro →
 * ../node_modules/@isar/drawio-pro → ../modules/drawio-pro → заглушка.
 */
function resolveDrawioProDir() {
  const candidates = [
    process.env.ISAR_DRAWIO_PRO_DIR,
    path.join(__dirname, 'node_modules', '@isar', 'drawio-pro'),
    path.join(__dirname, '..', 'node_modules', '@isar', 'drawio-pro'),
    path.join(__dirname, '..', 'modules', 'drawio-pro'),
  ].filter(Boolean)
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'frontend', 'DrawioProPanel.vue'))) return dir
  }
  return path.join(__dirname, 'src', 'modules', 'stubs', 'drawio-pro')
}

const drawioProDir = resolveDrawioProDir()
/**
 * CommonJS-фронт модуля может лежать вне `node_modules` (каталог modules/ или локальный чекаут):
 * без явного include Rollup не трансформирует require() и сборка падает.
 */
const drawioProGlob = `${drawioProDir.replace(/\\/g, '/')}/**`

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
      // Модуль подключается как публичный пакет; alias обходит package.json#exports
      // (модуль v0.1.0 не экспортирует ./frontend/*.vue) и подставляет заглушку при отсутствии.
      '@isar/drawio-pro': drawioProDir,
    },
  },
  build: {
    outDir: '../frontend-v3-dist',
    emptyOutDir: true,
    commonjsOptions: {
      // Фронт модуля написан в CommonJS и может лежать вне node_modules (modules/drawio-pro,
      // локальный чекаут): без этого Rollup не трансформирует require() и сборка падает.
      include: [/node_modules/, drawioProGlob],
    },
  },
  server: {
    port: 5175,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})

