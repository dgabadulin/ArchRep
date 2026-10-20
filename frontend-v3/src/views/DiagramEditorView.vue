<template>
  <div class="diagram-editor-page" :class="{ 'diagram-editor-page--minimal': isMinimal }">
    <div v-if="saveNotice || loadError || !drawioBase" class="diagram-alerts">
      <p v-if="saveNotice" class="save-notice" role="status">{{ saveNotice }}</p>
      <p v-if="loadError" class="error">
        {{ loadError }}
        <router-link
          v-if="diagramMissing && appliedId"
          class="error-link"
          :to="{ name: 'decision-applied-edit', params: { id: appliedId } }"
        >Открыть заключение</router-link>
      </p>
      <p v-if="!drawioBase" class="error">
        В конфигурации API не задан DRAWIO_EMBED_BASE (базовый URL Draw.io, например https://сервер/drawio).
      </p>
    </div>

    <iframe
      v-if="drawioBase && mxfile !== null && !loadError"
      :key="iframeEmbedKey"
      ref="iframeRef"
      class="diagram-iframe"
      :class="{ 'diagram-iframe--fullscreen': isMinimal }"
      title="Редактор схемы"
      :src="iframeSrc"
      @load="onIframeLoad"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { getConfig } from '@/config/params'
import { api } from '../api/client'
import { messageFromApiError } from '../utils/apiErrors'

const route = useRoute()
const isMinimal = computed(() => Boolean(route.meta.minimalLayout))

const iframeRef = ref(null)
const mxfile = ref(null)
const loadError = ref('')
const saving = ref(false)
const diagramXmlPushedToDrawio = ref(false)

const incrementId = computed(() => route.query.incrementId || '')
const diagramId = computed(() => route.query.diagramId || '')
/** id заключения — для ссылки на форму, когда схема не найдена (404). */
const appliedId = computed(() => normalizeQueryString(route.query.appliedId))
/** true, если API ответил 404: схема из ссылки удалена или ссылка устарела. */
const diagramMissing = ref(false)

function normalizeQueryString(val) {
  if (val == null || val === '') return ''
  const s = Array.isArray(val) ? val[0] : val
  return typeof s === 'string' ? s.trim() : String(s).trim()
}

/** Как в колонке «Имя файла» на форме заключения (параметр schemeLabel при открытии из формы). */
const schemeLabelFromQuery = computed(() => normalizeQueryString(route.query.schemeLabel))

const diagramMeta = ref(null)

/** Имя файла для Draw.io (заголовок в редакторе). */
const schemeDisplayName = computed(() => {
  if (schemeLabelFromQuery.value) return schemeLabelFromQuery.value
  const v = diagramMeta.value?.version_no
  if (v != null && !Number.isNaN(Number(v))) return `Схема v${v}`
  return 'Схема решения'
})

const drawioFileTitle = computed(() => `${schemeDisplayName.value}.drawio`)

const drawioBase = computed(() => {
  const b = (getConfig().DRAWIO_EMBED_BASE || '').trim()
  return b
})

const iframeSrc = computed(() => {
  let raw = drawioBase.value.trim()
  if (!raw) return ''
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`
  let u
  try {
    u = new URL(raw)
  } catch {
    return ''
  }
  let pathname = u.pathname || '/'
  if (pathname !== '/' && !pathname.endsWith('/')) pathname += '/'
  u.pathname = pathname
  const base = u.origin + u.pathname + (u.search || '')
  const sep = base.includes('?') ? '&' : '?'
  // libraries=1 — левая панель фигур; noExitBtn=1 — скрыть Exit (сохранение — только Save в Draw.io)
  return `${base}${sep}embed=1&proto=json&spin=1&ui=atlas&splash=0&libraries=1&noExitBtn=1`
})

const embedOpenNonce = computed(() => String(route.query._t || ''))
const iframeEmbedKey = computed(
  () => `${incrementId.value || 'x'}-${diagramId.value || 'x'}-${embedOpenNonce.value || '0'}`,
)

const saveNotice = ref('')
let saveNoticeTimer = null

function showSaveNotice(text) {
  saveNotice.value = text
  if (saveNoticeTimer != null) clearTimeout(saveNoticeTimer)
  saveNoticeTimer = setTimeout(() => {
    saveNotice.value = ''
    saveNoticeTimer = null
  }, 4500)
}

async function loadDiagram() {
  if (!incrementId.value || !diagramId.value) {
    loadError.value = 'Не указаны incrementId или diagramId в адресе страницы.'
    mxfile.value = null
    diagramMeta.value = null
    diagramMissing.value = false
    return
  }
  loadError.value = ''
  diagramMissing.value = false
  saveNotice.value = ''
  if (saveNoticeTimer != null) {
    clearTimeout(saveNoticeTimer)
    saveNoticeTimer = null
  }
  mxfile.value = null
  diagramMeta.value = null
  diagramXmlPushedToDrawio.value = false
  try {
    const row = await api.getIncrementDiagram(incrementId.value, diagramId.value)
    diagramMeta.value = row
    mxfile.value = row.mxfile || ''
    if (!mxfile.value) loadError.value = 'Пустой файл диаграммы'
  } catch (e) {
    // 404 API ({"error":"Not found"}): схема из ссылки отсутствует — вместо технического
    // «Not found» показываем понятный текст и ссылку на заключение (см. diagramMissing).
    diagramMissing.value = e?.status === 404
    loadError.value = diagramMissing.value
      ? `Схема не найдена: диаграмма ${diagramId.value} отсутствует в решении (инкремент ${incrementId.value}). ` +
        'Возможно, схема удалена, а ссылка устарела. Откройте схему заново из формы архитектурного заключения.'
      : messageFromApiError(e?.status, e?.body, e?.message) || 'Ошибка загрузки схемы'
    mxfile.value = null
  }
}

function postToIframe(data) {
  const win = iframeRef.value?.contentWindow
  if (!win) return
  win.postMessage(data, '*')
}

function sendLoadLegacyRawToIframe() {
  if (diagramXmlPushedToDrawio.value || mxfile.value == null) return
  const xml = typeof mxfile.value === 'string' ? mxfile.value : String(mxfile.value)
  if (!xml.trim()) return
  diagramXmlPushedToDrawio.value = true
  postToIframe(xml)
}

function sendLoadToIframe() {
  const win = iframeRef.value?.contentWindow
  if (!win || mxfile.value == null || diagramXmlPushedToDrawio.value) return
  const payload = {
    action: 'load',
    autosave: 1,
    xml: mxfile.value,
    exportProtocol: 1,
    title: drawioFileTitle.value,
  }
  diagramXmlPushedToDrawio.value = true
  postToIframe(JSON.stringify(payload))
}

let embedFallbackTimer = null

function onIframeLoad() {
  if (embedFallbackTimer != null) clearTimeout(embedFallbackTimer)
  embedFallbackTimer = setTimeout(() => {
    embedFallbackTimer = null
    if (mxfile.value && iframeRef.value?.contentWindow && !diagramXmlPushedToDrawio.value) {
      sendLoadToIframe()
    }
  }, 3000)
}

function handleMessage(ev) {
  const cw = iframeRef.value?.contentWindow
  if (!cw || ev.source !== cw) return

  if (typeof ev.data === 'string') {
    const s = ev.data.trim().replace(/^\uFEFF/, '')
    if (s === 'ready') {
      sendLoadLegacyRawToIframe()
      return
    }
  }

  let msg
  try {
    if (typeof ev.data === 'object' && ev.data !== null && typeof ev.data.event === 'string') {
      msg = ev.data
    } else if (typeof ev.data === 'string') {
      const t = ev.data.trim().replace(/^\uFEFF/, '')
      if (!t.startsWith('{')) return
      msg = JSON.parse(t)
    } else {
      return
    }
  } catch {
    return
  }

  if (msg.event === 'configure') {
    postToIframe(JSON.stringify({ action: 'configure', config: {} }))
    return
  }
  if (msg.event === 'init') {
    sendLoadToIframe()
  }
  if (msg.event === 'save' && typeof msg.xml === 'string') {
    persistMxfile(msg.xml)
  }
  if (msg.event === 'export') {
    const xml = typeof msg.xml === 'string' ? msg.xml : typeof msg.data === 'string' ? msg.data : null
    if (xml) persistMxfile(xml)
  }
}

async function persistMxfile(xml) {
  if (!incrementId.value || !diagramId.value || saving.value) return
  saving.value = true
  try {
    await api.putIncrementDiagram(incrementId.value, diagramId.value, { mxfile: xml })
    loadError.value = ''
    showSaveNotice('Изменения записаны в базу.')
  } catch (e) {
    loadError.value = messageFromApiError(e?.status, e?.body, e?.message) || 'Ошибка сохранения'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  window.addEventListener('message', handleMessage)
  loadDiagram()
})

watch(
  () => [route.query.incrementId, route.query.diagramId, route.query._t],
  () => {
    loadDiagram()
  },
)

onUnmounted(() => {
  window.removeEventListener('message', handleMessage)
  if (embedFallbackTimer != null) {
    clearTimeout(embedFallbackTimer)
    embedFallbackTimer = null
  }
  if (saveNoticeTimer != null) {
    clearTimeout(saveNoticeTimer)
    saveNoticeTimer = null
  }
})
</script>

<style scoped>
.diagram-editor-page {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
  width: 100%;
}
.diagram-editor-page:not(.diagram-editor-page--minimal) {
  height: calc(100vh - 120px);
  min-height: 400px;
}
.diagram-editor-page--minimal {
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
}

.diagram-alerts {
  flex-shrink: 0;
  padding: 0.5rem 1rem 0;
}
.diagram-alerts .save-notice,
.diagram-alerts .error {
  margin: 0.35rem 0 0;
}
.diagram-alerts .save-notice:first-child,
.diagram-alerts .error:first-child {
  margin-top: 0;
}

.diagram-iframe {
  flex: 1;
  width: 100%;
  min-height: 320px;
  border: 1px solid var(--color-border, #ddd);
  border-radius: 6px;
}
.diagram-iframe--fullscreen {
  min-height: 0;
  border: none;
  border-radius: 0;
  flex: 1 1 auto;
  width: 100%;
  height: 100%;
}

.save-notice {
  padding: 0.45rem 0.65rem;
  font-size: 0.88rem;
  color: #1a5d1a;
  background: #e8f5e9;
  border: 1px solid #a5d6a7;
  border-radius: 6px;
  flex-shrink: 0;
}

.error {
  color: var(--color-danger, #b00020);
  flex-shrink: 0;
}

.error-link {
  margin-left: 0.35rem;
  color: inherit;
  text-decoration: underline;
}
</style>
